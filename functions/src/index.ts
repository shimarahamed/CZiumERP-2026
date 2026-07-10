import {initializeApp} from "firebase-admin/app";

// No artificial instance cap — functions scale to the platform default
// (100 instances per function on Cloud Functions v2).

initializeApp();

export {inviteUser} from "./inviteUser";
export {setUserClaims} from "./setUserClaims";
export {loginRateLimit} from "./loginRateLimit";
export {auditTrail} from "./auditTrail";
export {postInvoiceWithLedger} from "./postInvoiceWithLedger";
export {refreshFxRates, refreshFxRatesNow} from "./fxRates";
export {computeRollups, computeRollupsNow} from "./computeRollups";
export {generateApiKey, revokeApiKey} from "./apiKeys";
export {restApi} from "./restApi";
export {
  superAdminListCollection,
  superAdminWriteDocument,
  superAdminDeleteDocument,
} from "./superAdminData";
export {
  superAdminListTenantUsers,
  superAdminSetUserPassword,
} from "./superAdminUsers";
