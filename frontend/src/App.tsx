import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { PrivateRoute, RoleRoute } from './routes/Guard';
import MainLayout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import CourseListPage from './pages/CourseListPage';
import CourseDetailPage from './pages/CourseDetailPage';
import ExperimentListPage from './pages/ExperimentListPage';
import ExperimentPage from './pages/ExperimentPage';
import RecordsPage from './pages/RecordsPage';
import ReportPage from './pages/ReportPage';
import ProfilePage from './pages/ProfilePage';
import TeacherDashboardPage from './pages/TeacherDashboardPage';
import AdminPage from './pages/AdminPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={<PrivateRoute><MainLayout /></PrivateRoute>}
          >
            <Route index element={<HomePage />} />
            <Route path="courses" element={<CourseListPage />} />
            <Route path="courses/:id" element={<CourseDetailPage />} />
            <Route path="experiments" element={<ExperimentListPage />} />
            <Route path="experiments/:id" element={<ExperimentPage />} />
            <Route path="records" element={<RecordsPage />} />
            <Route path="report/:id" element={<ReportPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route
              path="teacher"
              element={<RoleRoute roles={['teacher', 'admin']}><TeacherDashboardPage /></RoleRoute>}
            />
            <Route
              path="admin"
              element={<RoleRoute roles={['admin']}><AdminPage /></RoleRoute>}
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
