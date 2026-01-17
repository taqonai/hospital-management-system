import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

var API_URL = 'https://spetaar.ai/api/v1';
var TOKEN_KEY = 'patientPortalToken';

function BillingScreen() {
  var navigation = useNavigation();
  var [activeTab, setActiveTab] = useState('all');
  var [isLoading, setIsLoading] = useState(true);
  var [isRefreshing, setIsRefreshing] = useState(false);
  var [bills, setBills] = useState([]);
  var [summary, setSummary] = useState({ totalDue: 0, pendingBills: 0 });
  var [error, setError] = useState(null);

  function loadData() {
    setError(null);

    SecureStore.getItemAsync(TOKEN_KEY).then(function(token) {
      if (!token) {
        setError('Not logged in');
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      var headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      };

      // Fetch summary
      fetch(API_URL + '/patient-portal/billing/summary', {
        method: 'GET',
        headers: headers
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.success && data.data) {
          setSummary({
            totalDue: Number(data.data.totalDue || 0),
            pendingBills: Number(data.data.pendingBills || 0)
          });
        }
      })
      .catch(function(err) {
        console.log('Summary error:', err);
      });

      // Fetch bills
      var statusParam = activeTab === 'all' ? '' : '?status=' + activeTab.toUpperCase();
      fetch(API_URL + '/patient-portal/billing/bills' + statusParam, {
        method: 'GET',
        headers: headers
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.success && data.data) {
          setBills(data.data || []);
        } else {
          setBills([]);
        }
        setIsLoading(false);
        setIsRefreshing(false);
      })
      .catch(function(err) {
        console.log('Bills error:', err);
        setError('Failed to load bills');
        setBills([]);
        setIsLoading(false);
        setIsRefreshing(false);
      });
    }).catch(function(err) {
      console.log('Token error:', err);
      setError('Failed to get token');
      setIsLoading(false);
      setIsRefreshing(false);
    });
  }

  useEffect(function() {
    setIsLoading(true);
    loadData();
  }, [activeTab]);

  function onRefresh() {
    setIsRefreshing(true);
    loadData();
  }

  function formatMoney(val) {
    if (val == null) return 'AED 0.00';
    var n = Number(val);
    if (isNaN(n)) return 'AED 0.00';
    return 'AED ' + n.toFixed(2);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      var d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  }

  function getStatusColor(status) {
    if (!status) return '#6B7280';
    var s = status.toLowerCase();
    if (s === 'paid') return '#10B981';
    if (s === 'pending') return '#F59E0B';
    if (s === 'overdue') return '#EF4444';
    return '#6B7280';
  }

  function goToDetail(billId) {
    navigation.navigate('BillDetail', { billId: billId });
  }

  if (isLoading && !isRefreshing) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading billing...</Text>
      </View>
    );
  }

  var filteredBills = bills;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Total Due</Text>
              <Text style={styles.summaryValue}>{formatMoney(summary.totalDue)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Pending</Text>
              <Text style={styles.summaryValue}>{summary.pendingBills || 0}</Text>
            </View>
          </View>
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'all' && styles.tabActive]}
            onPress={function() { setActiveTab('all'); }}
          >
            <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'pending' && styles.tabActive]}
            onPress={function() { setActiveTab('pending'); }}
          >
            <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>Pending</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'paid' && styles.tabActive]}
            onPress={function() { setActiveTab('paid'); }}
          >
            <Text style={[styles.tabText, activeTab === 'paid' && styles.tabTextActive]}>Paid</Text>
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.empty}>
            <Ionicons name="alert-circle-outline" size={60} color="#EF4444" />
            <Text style={styles.emptyTitle}>Error</Text>
            <Text style={styles.emptyText}>{error}</Text>
          </View>
        ) : filteredBills.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={60} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No Bills Found</Text>
            <Text style={styles.emptyText}>
              {activeTab === 'pending' ? 'No pending bills' : activeTab === 'paid' ? 'No paid bills' : 'No billing history'}
            </Text>
          </View>
        ) : (
          <View style={styles.billsList}>
            {filteredBills.map(function(bill, index) {
              var billId = bill.id || bill.billId || index;
              var billNumber = bill.billNumber || bill.invoiceNumber || 'Bill #' + (index + 1);
              var amount = bill.totalAmount || bill.amount || 0;
              var status = bill.status || 'pending';
              var date = bill.billDate || bill.createdAt || bill.date;
              var description = bill.description || bill.serviceName || 'Medical Services';

              return (
                <TouchableOpacity
                  key={billId}
                  style={styles.billCard}
                  onPress={function() { goToDetail(billId); }}
                >
                  <View style={styles.billHeader}>
                    <View style={styles.billInfo}>
                      <Text style={styles.billNumber}>{billNumber}</Text>
                      <Text style={styles.billDate}>{formatDate(date)}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) + '20' }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(status) }]}>
                        {(status || '').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.billDescription} numberOfLines={1}>{description}</Text>
                  <View style={styles.billFooter}>
                    <Text style={styles.billAmount}>{formatMoney(amount)}</Text>
                    <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#6B7280' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  summaryCard: { backgroundColor: '#2563EB', borderRadius: 16, padding: 20, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryCol: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, height: 36, backgroundColor: '#60A5FA', marginHorizontal: 12 },
  summaryLabel: { fontSize: 13, color: '#BFDBFE', marginBottom: 4 },
  summaryValue: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  tabs: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 10, padding: 4, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#FFFFFF', elevation: 2 },
  tabText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  tabTextActive: { color: '#2563EB' },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginTop: 16 },
  emptyText: { fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center' },
  billsList: { gap: 12 },
  billCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, marginBottom: 12 },
  billHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  billInfo: { flex: 1 },
  billNumber: { fontSize: 16, fontWeight: '600', color: '#111827' },
  billDate: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '600' },
  billDescription: { fontSize: 14, color: '#4B5563', marginBottom: 12 },
  billFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12 },
  billAmount: { fontSize: 18, fontWeight: '700', color: '#111827' },
});

export default BillingScreen;
