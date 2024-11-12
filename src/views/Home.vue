<script setup>
import {ref} from 'vue';
import {useRouter} from 'vue-router';
import {useI18n} from 'vue-i18n';

const i18n = useI18n();

const tools = ref(
    [
      {
        key: 'TEORefresh',
        label: i18n.t('TEORefresh'),
      },
      {
        key: 'UUIDGenerate',
        label: i18n.t('UUIDGenerate'),
      },
      {
        key: 'Timestamp',
        label: i18n.t('TimestampTrans'),
      },
      {
        key: 'JSONPretty',
        label: i18n.t('JSONPretty'),
      },
    ],
);
tools.value.sort((a, b) => a.key.localeCompare(b.key));

const router = useRouter();
const goTo = (key) => {
  router.push({name: key});
};
</script>

<template>
  <a-space
    :fill="true"
    id="home"
  >
    <a-space
      id="home-space"
      direction="vertical"
    >
      <a-select
        class="home-space-select"
        :placeholder="$t('ChooseTool')"
        :filterable="true"
        :allow-search="true"
        popup-container="#home"
        @change="goTo"
        allow-clear
      >
        <a-option
          v-for="item in tools"
          :key="item.key"
          :label="item.label"
          :value="item.key"
        >
          {{ item.label }}
        </a-option>
      </a-select>
    </a-space>
  </a-space>
</template>

<style scoped>
#home {
  height: 100%;
  width: 100%;
  justify-content: center;
  align-items: center;
  background-image: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

#home-space {
  align-items: center;
}

:deep(.home-space-select) {
  width: 320px;
  height: 48px;
  text-align: center;
  background: unset;
  border: 2px solid var(--color-border-1);
}

@media (max-width: 319px) {
  :deep(.home-space-select) {
    width: unset;
  }
}

:deep(.home-space-select) .arco-select-view-input {
  text-align: center;
}

:deep(.home-space-select) .arco-select-view-value {
  align-items: center;
  justify-content: center;
}

#home :deep(.arco-select-option-content){
  text-align: center;
  width: 100%;
}

#home :deep(.arco-select-option),
#home :deep(.arco-select-dropdown) {
  background: unset;
}

#home :deep(.arco-select-dropdown) .arco-select-option-active, .arco-select-dropdown .arco-select-option:not(.arco-select-dropdown .arco-select-option-disabled):hover {
  color: rgb(var(--arcoblue-5));
}
</style>
