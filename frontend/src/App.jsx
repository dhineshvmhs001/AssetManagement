import { BrowserRouter, Route, Routes } from 'react-router-dom';
import SettingsButton from './components/common/Settings';
import AppShell from './components/layout/AppShell';
import { AuthProvider } from './auth/AuthProvider';
import { KeyboardProvider } from './keyboard/KeyboardProvider';
import RequireAuth from './auth/RequireAuth';
import RequireAccess, { RoleHomeRedirect } from './auth/RequireAccess';
import PageLoader from './ui/PageLoader';
import Login from './pages/login/Login';
import Dashboard from './pages/dashboard/Dashboard';
import InventoryLayout from './pages/inventory/InventoryLayout';
import AssetList from './pages/inventory/AssetList';
import AddAsset from './pages/inventory/AddAsset';
import EditAsset from './pages/inventory/EditAsset';
import BulkImport from './pages/inventory/BulkImport';
import AssetDetails from './pages/inventory/AssetDetails';
import PrintSticker from './pages/inventory/PrintSticker';
import VendorLayout from './pages/vendors/VendorLayout';
import VendorList from './pages/vendors/VendorList';
import AddVendor from './pages/vendors/AddVendor';
import VendorDetails from './pages/vendors/VendorDetails';
import EditVendor from './pages/vendors/EditVendor';
import Assignment from './pages/assignment/Assignment';
import Maintenance from './pages/maintenance/Maintenance';
import EmployeeLayout from './pages/employees/EmployeeLayout';
import EmployeeList from './pages/employees/EmployeeList';
import AddEmployee from './pages/employees/AddEmployee';
import BulkImportEmployees from './pages/employees/BulkImportEmployees';
import EmployeeDetails from './pages/employees/EmployeeDetails';
import EditEmployee from './pages/employees/EditEmployee';
import TicketLayout from './pages/tickets/TicketLayout';
import TicketList from './pages/tickets/TicketList';
import CreateTicket from './pages/tickets/CreateTicket';
import TicketDetails from './pages/tickets/TicketDetails';
import Activity from './pages/activity/Activity';
import Reports from './pages/reports/Reports';
import MyAssets from './pages/my-assets/MyAssets';
import Test from './pages/test/Test';
import MailTest from './pages/mail/MailTest';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <PageLoader />
        <Routes>
          <Route
            path="/login"
            element={
              <>
                <SettingsButton variant="float" />
                <Login />
              </>
            }
          />
          <Route
            path="/test"
            element={
              <>
                <SettingsButton variant="float" />
                <Test />
              </>
            }
          />
          <Route
            path="/mail"
            element={
              <>
                <SettingsButton variant="float" />
                <MailTest />
              </>
            }
          />
          <Route element={<RequireAuth />}>
            <Route
              element={
                <KeyboardProvider>
                  <AppShell />
                </KeyboardProvider>
              }
            >
              <Route element={<RequireAccess />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/inventory" element={<InventoryLayout />}>
                  <Route index element={<AssetList />} />
                  <Route path="add" element={<AddAsset />} />
                  <Route path="import" element={<BulkImport />} />
                  <Route path=":code" element={<AssetDetails />} />
                  <Route path=":code/edit" element={<EditAsset />} />
                  <Route path=":code/sticker" element={<PrintSticker />} />
                </Route>
                <Route path="/vendors" element={<VendorLayout />}>
                  <Route index element={<VendorList />} />
                  <Route path="add" element={<AddVendor />} />
                  <Route path=":code" element={<VendorDetails />} />
                  <Route path=":code/edit" element={<EditVendor />} />
                </Route>
                <Route path="/assignment" element={<Assignment />} />
                <Route path="/maintenance" element={<Maintenance />} />
                <Route path="/employees" element={<EmployeeLayout />}>
                  <Route index element={<EmployeeList />} />
                  <Route path="add" element={<AddEmployee />} />
                  <Route path="import" element={<BulkImportEmployees />} />
                  <Route path=":code" element={<EmployeeDetails />} />
                  <Route path=":code/edit" element={<EditEmployee />} />
                </Route>
                <Route path="/tickets" element={<TicketLayout />}>
                  <Route index element={<TicketList />} />
                  <Route path="add" element={<CreateTicket />} />
                  <Route path=":code" element={<TicketDetails />} />
                </Route>
                <Route path="/my-assets" element={<MyAssets />} />
                <Route path="/activity" element={<Activity />} />
                <Route path="/reports" element={<Reports />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<RoleHomeRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
