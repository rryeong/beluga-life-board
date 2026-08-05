import { createRouter, createWebHistory } from 'vue-router'

import HomeView from '@/views/HomeView.vue'

import MealLayout from '@/layouts/MealLayout.vue'
import WeeklyMenuView from '@/views/meal/WeeklyMenuView.vue'
import FridgeView from '@/views/meal/FridgeView.vue'
import FreezerView from '@/views/meal/FreezerView.vue'
import MealPrepView from '@/views/meal/MealPrepView.vue'
import WishlistView from '@/views/meal/WishlistView.vue'

import BusLayout from '@/layouts/BusLayout.vue'
import CommuteBusView from '@/views/bus/CommuteBusView.vue'
import ReturnBusView from '@/views/bus/ReturnBusView.vue'

import TennisView from '@/views/tennis/TennisView.vue'

const router = createRouter({
  history: createWebHistory(),

  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/meal',
      component: MealLayout,
      redirect: '/meal/weekly-menu',
      children: [
        {
          path: 'weekly-menu',
          name: 'weekly-menu',
          component: WeeklyMenuView,
        },
        {
          path: 'fridge',
          name: 'fridge',
          component: FridgeView,
        },
        {
          path: 'freezer',
          name: 'freezer',
          component: FreezerView,
        },
        {
          path: 'meal-prep',
          name: 'meal-prep',
          component: MealPrepView,
        },
        {
          path: 'wishlist',
          name: 'wishlist',
          component: WishlistView,
        },
      ],
    },
    {
      path: '/bus',
      component: BusLayout,
      redirect: '/bus/commute',
      children: [
        {
          path: 'commute',
          name: 'commute-bus',
          component: CommuteBusView,
        },
        {
          path: 'return',
          name: 'return-bus',
          component: ReturnBusView,
        },
      ],
    },
    {
      path: '/tennis',
      name: 'tennis',
      component: TennisView,
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

export default router