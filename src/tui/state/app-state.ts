export type AppRoute = "home";

export type AppState = {
  route: AppRoute;
};

export const initialAppState: AppState = {
  route: "home",
};
