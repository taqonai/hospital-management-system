import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
  Chip,
  Alert,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { api } from '../../services/api';

interface Charge {
  id: string;
  code: string;
  description: string;
  category: string;
  defaultPrice: number;
  currency: string;
  unit: string | null;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
}

interface FeeSchedule {
  id: string;
  chargeId: string;
  price: number;
  discount: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  charge: {
    code: string;
    description: string;
    category: string;
    defaultPrice: number;
  };
  insurancePayer: {
    id: string;
    name: string;
    code: string;
  } | null;
}

const ChargeMaster: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [feeSchedules, setFeeSchedules] = useState<FeeSchedule[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalCharges, setTotalCharges] = useState(0);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState<boolean | ''>('');

  // Dialogs
  const [openChargeDialog, setOpenChargeDialog] = useState(false);
  const [openFeeDialog, setOpenFeeDialog] = useState(false);
  const [editingCharge, setEditingCharge] = useState<Charge | null>(null);

  // Form data
  const [chargeForm, setChargeForm] = useState({
    code: '',
    description: '',
    category: '',
    defaultPrice: '',
    currency: 'AED',
    unit: '',
  });

  const [feeForm, setFeeForm] = useState({
    chargeId: '',
    payerId: '',
    price: '',
    discount: '',
  });

  useEffect(() => {
    loadCharges();
    loadCategories();
  }, [page, rowsPerPage, searchTerm, categoryFilter, activeFilter]);

  useEffect(() => {
    if (activeTab === 1) {
      loadFeeSchedules();
    }
  }, [activeTab]);

  const loadCharges = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {
        page: page + 1,
        limit: rowsPerPage,
      };
      if (searchTerm) params.search = searchTerm;
      if (categoryFilter) params.category = categoryFilter;
      if (activeFilter !== '') params.isActive = activeFilter;

      const response = await api.get('/charge-management/charge-master', { params });
      setCharges(response.data.data);
      setTotalCharges(response.data.pagination.total);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load charges');
    } finally {
      setLoading(false);
    }
  };

  const loadFeeSchedules = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/charge-management/fee-schedules', {
        params: { page: 1, limit: 100 },
      });
      setFeeSchedules(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load fee schedules');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await api.get('/charge-management/categories');
      setCategories(response.data.data);
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  };

  const handleCreateCharge = async () => {
    setError(null);
    setSuccess(null);
    try {
      await api.post('/charge-management/charge-master', {
        ...chargeForm,
        defaultPrice: parseFloat(chargeForm.defaultPrice),
      });
      setSuccess('Charge created successfully');
      setOpenChargeDialog(false);
      resetChargeForm();
      loadCharges();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create charge');
    }
  };

  const handleUpdateCharge = async () => {
    if (!editingCharge) return;
    setError(null);
    setSuccess(null);
    try {
      await api.put(`/charge-management/charge-master/${editingCharge.id}`, {
        ...chargeForm,
        defaultPrice: parseFloat(chargeForm.defaultPrice),
      });
      setSuccess('Charge updated successfully');
      setOpenChargeDialog(false);
      setEditingCharge(null);
      resetChargeForm();
      loadCharges();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update charge');
    }
  };

  const handleDeactivateCharge = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this charge?')) return;
    setError(null);
    setSuccess(null);
    try {
      await api.delete(`/charge-management/charge-master/${id}`);
      setSuccess('Charge deactivated successfully');
      loadCharges();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to deactivate charge');
    }
  };

  const handleSeedCharges = async () => {
    if (!confirm('This will seed hardcoded charges into the database. Continue?')) return;
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const response = await api.post('/charge-management/seed-charges');
      setSuccess(`Seeded ${response.data.data.created} charges, skipped ${response.data.data.skipped}`);
      loadCharges();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to seed charges');
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (charge: Charge) => {
    setEditingCharge(charge);
    setChargeForm({
      code: charge.code,
      description: charge.description,
      category: charge.category,
      defaultPrice: charge.defaultPrice.toString(),
      currency: charge.currency,
      unit: charge.unit || '',
    });
    setOpenChargeDialog(true);
  };

  const resetChargeForm = () => {
    setChargeForm({
      code: '',
      description: '',
      category: '',
      defaultPrice: '',
      currency: 'AED',
      unit: '',
    });
    setEditingCharge(null);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Charge Master Management</Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadCharges}
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleSeedCharges}
            sx={{ mr: 1 }}
          >
            Seed Charges
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenChargeDialog(true)}
          >
            Add Charge
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 2 }}>
        <Tab label="Charge Master" />
        <Tab label="Fee Schedules" />
      </Tabs>

      {activeTab === 0 && (
        <>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                      endAdornment: <SearchIcon />,
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    select
                    label="Category"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <MenuItem value="">All</MenuItem>
                    {categories.map((cat) => (
                      <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    select
                    label="Status"
                    value={activeFilter}
                    onChange={(e) => setActiveFilter(e.target.value === '' ? '' : e.target.value === 'true')}
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="true">Active</MenuItem>
                    <MenuItem value="false">Inactive</MenuItem>
                  </TextField>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell align="right">Price</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">Loading...</TableCell>
                  </TableRow>
                ) : charges.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">No charges found</TableCell>
                  </TableRow>
                ) : (
                  charges.map((charge) => (
                    <TableRow key={charge.id}>
                      <TableCell>{charge.code}</TableCell>
                      <TableCell>{charge.description}</TableCell>
                      <TableCell>
                        <Chip label={charge.category} size="small" color="primary" variant="outlined" />
                      </TableCell>
                      <TableCell align="right">
                        {charge.currency} {charge.defaultPrice.toFixed(2)}
                      </TableCell>
                      <TableCell>{charge.unit || '-'}</TableCell>
                      <TableCell>
                        <Chip
                          label={charge.isActive ? 'Active' : 'Inactive'}
                          size="small"
                          color={charge.isActive ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => openEditDialog(charge)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        {charge.isActive && (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeactivateCharge(charge.id)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={totalCharges}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </TableContainer>
        </>
      )}

      {activeTab === 1 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Charge Code</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Payer</TableCell>
                <TableCell align="right">Base Price</TableCell>
                <TableCell align="right">Contract Price</TableCell>
                <TableCell align="right">Discount %</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {feeSchedules.map((schedule) => (
                <TableRow key={schedule.id}>
                  <TableCell>{schedule.charge.code}</TableCell>
                  <TableCell>{schedule.charge.description}</TableCell>
                  <TableCell>{schedule.insurancePayer?.name || 'Default'}</TableCell>
                  <TableCell align="right">{schedule.charge.defaultPrice.toFixed(2)}</TableCell>
                  <TableCell align="right">{schedule.price.toFixed(2)}</TableCell>
                  <TableCell align="right">{schedule.discount || '-'}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small">
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Charge Dialog */}
      <Dialog open={openChargeDialog} onClose={() => {
        setOpenChargeDialog(false);
        resetChargeForm();
      }} maxWidth="sm" fullWidth>
        <DialogTitle>{editingCharge ? 'Edit Charge' : 'Add New Charge'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Code"
                value={chargeForm.code}
                onChange={(e) => setChargeForm({ ...chargeForm, code: e.target.value })}
                disabled={!!editingCharge}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                select
                label="Category"
                value={chargeForm.category}
                onChange={(e) => setChargeForm({ ...chargeForm, category: e.target.value })}
              >
                {categories.map((cat) => (
                  <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={chargeForm.description}
                onChange={(e) => setChargeForm({ ...chargeForm, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Default Price"
                value={chargeForm.defaultPrice}
                onChange={(e) => setChargeForm({ ...chargeForm, defaultPrice: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Unit"
                value={chargeForm.unit}
                onChange={(e) => setChargeForm({ ...chargeForm, unit: e.target.value })}
                placeholder="e.g., per visit, per day"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setOpenChargeDialog(false);
            resetChargeForm();
          }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={editingCharge ? handleUpdateCharge : handleCreateCharge}
          >
            {editingCharge ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ChargeMaster;
