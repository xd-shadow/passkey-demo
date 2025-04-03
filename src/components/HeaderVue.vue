<template>
  <header class="header">
    <nav>
      <router-link v-for="route in routes" :key="route.path" :to="route.path" class="nav-link">
        {{ route.name }}
      </router-link>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { routes } from "../router/index";
</script>

<style lang="scss" scoped>
.header {
  padding: 1rem;
  background: #f5f5f5;

  nav {
    display: flex;
    gap: 1rem;
  }

  .nav-link {
    padding: 0.5rem 1rem;
    text-decoration: none;
    color: #333;

    &:hover {
      background: #ddd;
    }

    &.router-link-exact-active {
      color: #fff;
      background: #42b983;
    }
  }
}
</style>
