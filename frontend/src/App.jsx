import {
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { AppLayout } from "./components/pages/app-layout";
import { FieldDetail } from "./components/pages/field-detail";
import { FieldsPage } from "./components/pages/fields";
import { SignInPage } from "./components/pages/signin";
import { SignUpPage } from "./components/pages/signup";
import { WeatherPage } from "./components/pages/weather";

const rootRoute = createRootRoute({
  component: Outlet,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => <Navigate to="/signup" replace />,
});

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/signup",
  component: SignUpPage,
});

const signinRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/signin",
  component: SignInPage,
});

const fieldDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/field",
  component: () => (
    <AppLayout active="field">
      <FieldDetail />
    </AppLayout>
  ),
});

const fieldsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/fields",
  component: () => (
    <AppLayout active="fields">
      <FieldsPage />
    </AppLayout>
  ),
});

const weatherRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/weather",
  component: () => (
    <AppLayout active="weather">
      <WeatherPage />
    </AppLayout>
  ),
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  signupRoute,
  signinRoute,
  fieldDetailRoute,
  fieldsRoute,
  weatherRoute,
]);

const router = createRouter({ routeTree });

function App() {
  return <RouterProvider router={router} />;
}

export default App;
