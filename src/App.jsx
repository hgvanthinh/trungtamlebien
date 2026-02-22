import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { BackgroundProvider } from './contexts/BackgroundContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Leaderboard from './pages/Leaderboard';
import Rules from './pages/Rules';
import Profile from './pages/Profile';
import AdminDashboard from './pages/admin/AdminDashboard';
import Students from './pages/admin/Students';
import Classes from './pages/admin/Classes';
import Teaching from './pages/admin/Teaching';
import Attendance from './pages/admin/Attendance';
import ExamBank from './pages/admin/ExamBank';
import GradeSubmissions from './pages/admin/GradeSubmissions';
import GradeSubmissionDetail from './pages/admin/GradeSubmissionDetail';
import Exams from './pages/Exams';
import ExamTaking from './pages/ExamTaking';
import ExamResult from './pages/ExamResult';
import Videos from './pages/Videos';
import VideoLibrary from './pages/admin/VideoLibrary';
import Violations from './pages/admin/Violations';
import Crafting from './pages/Crafting';
import BackgroundSettings from './pages/admin/BackgroundSettings';
import Store from './pages/Store';
import Inventory from './pages/Inventory';
import AdminStore from './pages/admin/AdminStore';
import GameLobby from './pages/public/GameLobby';
import BombGame from './pages/public/BombGame';
import PhaserBombGame from './pages/public/PhaserBombGame';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BackgroundProvider>
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Protected routes - Student */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Home />} />
                <Route path="leaderboard" element={<Leaderboard />} />
                <Route path="rules" element={<Rules />} />
                <Route path="profile" element={<Profile />} />
                <Route path="crafting" element={<Crafting />} />
                <Route path="store" element={<Store />} />
                <Route path="inventory" element={<Inventory />} />
                <Route path="exams" element={<Exams />} />
                <Route path="exam/:examId" element={<ExamTaking />} />
                <Route path="exam/:examId/result/:submissionId" element={<ExamResult />} />
                <Route path="videos" element={<Videos />} />
                <Route path="game-lobby" element={<GameLobby />} />
                <Route path="game/:roomId" element={<BombGame />} />
                <Route path="phaser-game/:roomId" element={<PhaserBombGame />} />
              </Route>

              {/* Admin routes */}
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <Layout />
                  </AdminRoute>
                }
              >
                <Route index element={<AdminDashboard />} />
                <Route path="students" element={<Students />} />
                <Route path="classes" element={<Classes />} />
                <Route path="teaching" element={<Teaching />} />
                <Route path="violations" element={<Violations />} />
                <Route path="attendance" element={<Attendance />} />
                <Route path="exam-bank" element={<ExamBank />} />
                <Route path="grade-submissions" element={<GradeSubmissions />} />
                <Route path="grade-submissions/:submissionId" element={<GradeSubmissionDetail />} />
                <Route path="videos" element={<VideoLibrary />} />
                <Route path="background-settings" element={<BackgroundSettings />} />
                <Route path="store" element={<AdminStore />} />
              </Route>

              {/* Catch all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </BackgroundProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
