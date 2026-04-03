export const AppCard = {
  props: {
    title: {
      type: String,
      default: ''
    },
    badge: {
      type: String,
      default: ''
    },
    badgeClass: {
      type: String,
      default: 'badge badge-muted'
    },
    cardClass: {
      type: String,
      default: ''
    },
    headerClass: {
      type: String,
      default: ''
    }
  },
  template: `
    <div class="card" :class="cardClass">
      <div v-if="title || badge || $slots.actions" class="section-header" :class="headerClass">
        <div v-if="title" class="section-title">{{ title }}</div>
        <slot name="actions">
          <span v-if="badge" :class="badgeClass">{{ badge }}</span>
        </slot>
      </div>
      <slot></slot>
    </div>
  `
};

export const AppList = {
  props: {
    items: {
      type: Array,
      default: () => []
    },
    itemKey: {
      type: String,
      default: 'id'
    },
    listClass: {
      type: String,
      default: 'flex flex-col gap-2.5'
    }
  },
  template: `
    <div :class="listClass">
      <template v-for="item in items" :key="item[itemKey] ?? JSON.stringify(item)">
        <slot :item="item"></slot>
      </template>
    </div>
  `
};
