import { createHashRouter } from "react-router-dom"
import { Navigate } from "react-router-dom"
import Layout from "@/pages/_layout"
import DashboardPage from "@/pages/dashboard"
import BuildDashboardPage from "@/pages/build-dashboard"
import SubmitIdeaPage from "@/pages/submit-idea"
import MySubmissionsPage from "@/pages/my-submissions"
import MyApprovalsPage from "@/pages/my-approvals"
import AnalyticsPage from "@/pages/analytics"
import SubmissionDetailPage from "@/pages/submission-detail"
import ScorecardPage from "@/pages/scorecard"
import LookupTablesPage from "@/pages/lookup-tables"
import CoeRolesPage from "@/pages/coe-roles"
import ScorecardConfigPage from "@/pages/scorecard-config"
import AiCoeTeamPage from "@/pages/ai-coe-team"
import NotFoundPage from "@/pages/not-found"

// IMPORTANT: Do not remove or modify the code below!
// Normalize the URL when hosted in Power Apps. The Power Apps host serves the
// app from a deep storage-proxy path and may append `/index.html`; strip it so
// the address bar stays clean. We deliberately do NOT feed this pathname into
// the router as a basename: this app uses createHashRouter, whose routing lives
// entirely in the URL fragment (e.g. `#/dashboard`). The fragment is always
// rooted at "/", so a pathname-derived basename would never match and the
// router would render nothing (blank screen). See issue: HashRouter basename.
const HOST_PATHNAME = new URL(".", location.href).pathname
if (location.pathname.endsWith("/index.html")) {
  history.replaceState(null, "", HOST_PATHNAME + location.search + location.hash);
}

export const router = createHashRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "build", element: <BuildDashboardPage /> },
      { path: "submit", element: <SubmitIdeaPage /> },
      { path: "submit/:id", element: <SubmitIdeaPage /> },
      { path: "my-ideas", element: <MySubmissionsPage /> },
      { path: "my-approvals", element: <MyApprovalsPage /> },
      { path: "analytics", element: <AnalyticsPage /> },
      { path: "lookup-tables", element: <LookupTablesPage /> },
      { path: "coe-roles", element: <CoeRolesPage /> },
      { path: "scorecard-config", element: <ScorecardConfigPage /> },
      { path: "ai-coe-team", element: <AiCoeTeamPage /> },
      { path: "submissions/:id", element: <SubmissionDetailPage /> },
      { path: "submissions/:id/scorecard", element: <ScorecardPage /> },
    ],
  },
])