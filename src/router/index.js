import { createRouter, createWebHashHistory } from 'vue-router'

import MealLayout from '@/views/meal/MealLayout.vue'

import WeeklyMenuView from '@/views/meal/WeeklyMenuView.vue'
import FridgeView from '@/views/meal/FridgeView.vue'
import FreezerView from '@/views/meal/FreezerView.vue'
import MealPrepView from '@/views/meal/MealPrepView.vue'
import WishlistView from '@/views/meal/WishlistView.vue'
import ShoppingListView from '@/views/meal/ShoppingListView.vue'

import BusLayout from '@/views/bus/BusLayout.vue'
import CommuteBusView from '@/views/bus/CommuteBusView.vue'
import ReturnBusView from '@/views/bus/ReturnBusView.vue'

import CommuteLayout from '@/views/commute/CommuteLayout.vue'
import BelugaCommuteView from '@/views/commute/BelugaCommuteView.vue'
import OppaCommuteView from '@/views/commute/OppaCommuteView.vue'

import TennisView from '@/views/tennis/TennisView.vue'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),

  routes: [
    {
      path: '/',
      redirect: '/meal/weekly-menu',
    },

    {
      path: '/meal',
      component: MealLayout,
      redirect: '/meal/weekly-menu',

      children: [
        {
          path: 'weekly-menu',
          name: 'meal-weekly-menu',
          component: WeeklyMenuView,
        },
        {
          path: 'fridge',
          name: 'meal-fridge',
          component: FridgeView,
        },
        {
          path: 'freezer',
          name: 'meal-freezer',
          component: FreezerView,
        },
        {
          path: 'meal-prep',
          name: 'meal-prep',
          component: MealPrepView,
        },
        {
          path: 'wishlist',
          name: 'meal-wishlist',
          component: WishlistView,
        },
        {
          path: 'shopping',
          name: 'meal-shopping',
          component: ShoppingListView,
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
          name: 'bus-commute',
          component: CommuteBusView,
        },
        {
          path: 'return',
          name: 'bus-return',
          component: ReturnBusView,
        },
      ],
    },

    {
      path: '/commute',
      component: CommuteLayout,
      redirect: '/commute/beluga',

      children: [
        {
          path: 'beluga',
          name: 'commute-beluga',
          component: BelugaCommuteView,
        },
        {
          path: 'oppa',
          name: 'commute-oppa',
          component: OppaCommuteView,
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
      redirect: '/meal/weekly-menu',
    },
  ],

  scrollBehavior() {
    return {
      top: 0,
      left: 0,
    }
  },
})

export default router
