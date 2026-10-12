import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("schedule", "routes/schedule.tsx"),
  route("residents", "routes/residents.tsx"),
  route("past-shows", "routes/past-shows.tsx"),
  route("about", "routes/about.tsx"),
] satisfies RouteConfig;
