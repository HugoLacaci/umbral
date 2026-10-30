import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell, useApplyTheme } from '@/components/layout/AppShell';
import { LoadingBlock } from '@/components/ui';
import { useApp } from '@/store';

const Onboarding = lazy(() => import('@/features/onboarding/Onboarding'));
const Dashboard = lazy(() => import('@/features/dashboard/Dashboard'));
const StudyHome = lazy(() => import('@/features/study/StudyHome'));
const LessonView = lazy(() => import('@/features/study/LessonView'));
const DeckView = lazy(() => import('@/features/study/DeckView'));
const GrammarView = lazy(() => import('@/features/study/GrammarView'));
const PracticeHome = lazy(() => import('@/features/practice/PracticeHome'));
const PracticeList = lazy(() => import('@/features/practice/PracticeList'));
const PracticeRun = lazy(() => import('@/features/practice/PracticeRun'));
const DrillSession = lazy(() => import('@/features/practice/DrillSession'));
const ExamHome = lazy(() => import('@/features/exam/ExamHome'));
const ExamSession = lazy(() => import('@/features/exam/ExamSession'));
const ExamReport = lazy(() => import('@/features/exam/ExamReport'));
const HistoryPage = lazy(() => import('@/features/history/History'));
const SettingsPage = lazy(() => import('@/features/settings/Settings'));

function Shell() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <LoadingBlock />
        </div>
      }
    >
      <AppShell />
    </Suspense>
  );
}

export function App() {
  useApplyTheme();
  const hydrated = useApp((s) => s.hydrated);
  const onboarded = useApp((s) => s.onboarded);

  if (!hydrated)
    return (
      <div className="mx-auto max-w-3xl p-8">
        <LoadingBlock />
      </div>
    );

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl p-8">
          <LoadingBlock />
        </div>
      }
    >
      <Routes>
        <Route path="/welcome" element={<Onboarding />} />
        {/* El modo examen va a pantalla completa, fuera del shell */}
        <Route path="/exam/run/:exam/:mock/:scope" element={<ExamSession />} />
        <Route element={onboarded ? <Shell /> : <Navigate to="/welcome" replace />}>
          <Route index element={<Dashboard />} />
          <Route path="study" element={<StudyHome />} />
          <Route path="study/:tab" element={<StudyHome />} />
          <Route path="study/lesson/:id" element={<LessonView />} />
          <Route path="study/deck/:id" element={<DeckView />} />
          <Route path="study/grammar-topic/:id" element={<GrammarView />} />
          <Route path="practice" element={<PracticeHome />} />
          <Route path="practice/drills" element={<DrillSession />} />
          <Route path="practice/:bank" element={<PracticeList />} />
          <Route path="practice/:bank/:id" element={<PracticeRun />} />
          <Route path="exam" element={<ExamHome />} />
          <Route path="exam/report/:id" element={<ExamReport />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
