import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";
import Home from "../views/HomePage.vue";
import AbstractAccount from "../views/AbstractAccount.vue";
export const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    name: "创建&签名",
    component: Home,
  },
  {
    path: "/aa",
    name: "aa账户",
    component: AbstractAccount,
  },
  {
    path: "/poly",
    name: "keypass控制aa",
    component: () => import("../views/PolyAction.vue"),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});
export default router;
