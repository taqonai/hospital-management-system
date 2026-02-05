const fs = require("fs");

const filePath = "./frontend/src/components/billing/CopayCollectionModal.tsx";
let content = fs.readFileSync(filePath, "utf8");

// 1. Add insuranceExpired to the CopayInfo interface
const pattern1 = /(preAuthMessage\?: string \| null;)/;
const replacement1 = "$1\n  // Insurance expiry\n  insuranceExpired?: boolean;\n  insuranceExpiryDate?: string | null;";

if (pattern1.test(content)) {
  content = content.replace(pattern1, replacement1);
  console.log("Added insuranceExpired to interface");
}

// 2. Add expired insurance warning section
const pattern2 = /({\\/\* GAP 1: Pre-Authorization Warning \*\/})/;
const replacement2 = `{/* INSURANCE EXPIRED WARNING */}
                {copayInfo.insuranceExpired && (
                  <div className="bg-red-50 border-2 border-red-400 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <ExclamationTriangleIcon className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="text-red-800 font-semibold text-lg">Insurance Expired</h4>
                        <p className="text-red-700 text-sm mt-1">
                          Policy expired on <strong>{copayInfo.insuranceExpiryDate ? new Date(copayInfo.insuranceExpiryDate).toLocaleDateString() : "Unknown"}</strong>.
                          Update insurance or pay as Self-Pay.
                        </p>
                        <div className="mt-3 flex gap-2">
                          <button onClick={() => setShowEidLookup(true)} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">Update Insurance</button>
                          <button onClick={handleConvertToSelfPay} className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700">Treat as Self-Pay</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                $1`;

if (pattern2.test(content)) {
  content = content.replace(pattern2, replacement2);
  console.log("Added expired insurance warning");
}

// 3. Hide pre-auth when expired
content = content.replace(/\{copayInfo\.preAuthRequired && \(/g, "{copayInfo.preAuthRequired && !copayInfo.insuranceExpired && (");
console.log("Modified pre-auth condition");

fs.writeFileSync(filePath, content);
console.log("Done!");
