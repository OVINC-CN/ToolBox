<script setup>
import {computed, onMounted, onUnmounted, ref} from 'vue';
import {useRouter} from 'vue-router';
import moment from 'moment';

const router = useRouter();

const datetimeIntUnit = ref(1000);
const changeDatetimeUnit = () => {
  if (datetimeIntUnit.value === 1000) {
    datetimeIntUnit.value = 1;
    datetimeInt.value = Math.round(datetimeInt.value / 1000);
  } else {
    datetimeIntUnit.value = 1000;
    datetimeInt.value = datetimeInt.value * 1000;
  }
};

const dateStr = ref(moment().format('YYYY-MM-DD'));
const timeStr = ref(moment().format('HH:mm:ss'));
const datetimeInt = ref(0);

const onDatetimeStrChange = (val) => {
  try {
    const m = moment(val);
    if (datetimeIntUnit.value === 1000) {
      datetimeInt.value = m.valueOf();
    } else {
      datetimeInt.value = m.unix();
    }
  } catch (_) {}
};
const onDateStrChange = (val) => {
  onDatetimeStrChange(`${val} ${timeStr.value}`);
};
const onTimeStrChange = (val) => {
  onDatetimeStrChange(`${dateStr.value} ${val}`);
};
const onDatetimeIntChange = (val) => {
  try {
    let m;
    if (datetimeIntUnit.value === 1000) {
      m = moment(val);
    } else {
      m = moment.unix(val);
    }
    dateStr.value = m.format('YYYY-MM-DD');
    timeStr.value = m.format('HH:mm:ss');
  } catch (_) {}
};
onMounted(() => {
  onDatetimeStrChange(`${dateStr.value} ${timeStr.value}`);
});

const windowWidth = ref(window.innerWidth);
onMounted(() => window.addEventListener('resize', () => windowWidth.value = window.innerWidth));
onUnmounted(() => window.removeEventListener('resize', () => {}));
const layout = computed(() => {
  return windowWidth.value > 600 ? 'horizontal' : 'vertical';
});

const autoRefresh = ref(false);
const autoRefreshTimer = ref(null);
const refresh = () => {
  autoRefreshTimer.value = setTimeout(
      () => {
        if (autoRefresh.value) {
          onDatetimeStrChange(moment().format('YYYY-MM-DD HH:mm:ss'));
          onDatetimeIntChange(datetimeInt.value);
        }
        refresh();
      },
      1000,
  );
};
onMounted(() => refresh());
onUnmounted(() => clearTimeout(autoRefreshTimer.value));
</script>

<template>
  <a-layout id="uuid-generate">
    <div id="uuid-generate-content">
      <a-link @click="router.push({name: 'Home'})">
        <a-space>
          <icon-left />
          <span>
            {{ $t('BackHome') }}
          </span>
        </a-space>
      </a-link>
      <a-divider />
      <a-space
        class="uuid-generate-content-box"
        :direction="layout"
      >
        <a-space style="width: 100%">
          <a-date-picker
            v-model="dateStr"
            @change="onDateStrChange"
            @select="onDateStrChange"
            @input="onDateStrChange"
            style="width: 100%"
            :allow-clear="false"
          />
          <a-time-picker
            v-model="timeStr"
            @change="onTimeStrChange"
            @select="onTimeStrChange"
            @input="onTimeStrChange"
            style="width: 120px"
            :allow-clear="false"
          />
        </a-space>
        <a-link
          @click="autoRefresh = !autoRefresh"
          style="color: var(--color-text-1)"
        >
          <icon-loading
            v-if="autoRefresh"
          />
          <icon-swap
            v-else
          />
        </a-link>
        <a-input-number
          v-model="datetimeInt"
          hide-button
          :min="0"
          @change="onDatetimeIntChange"
          @input="onDatetimeIntChange"
          style="width: 100%"
        >
          <template #suffix>
            <a-link
              @click="changeDatetimeUnit"
              style="color: var(--color-text-1)"
            >
              <div>
                {{ datetimeIntUnit === 1000 ? $t('milliseconds') : $t('seconds') }}
              </div>
            </a-link>
          </template>
        </a-input-number>
      </a-space>
    </div>
  </a-layout>
</template>

<style scoped>
#uuid-generate {
  height: 100%;
  width: 100%;
  justify-content: center;
  align-items: center;
  background-image: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

#uuid-generate-content {
  min-width: 320px;
  width: 90vw;
  max-width: 800px;
  background: var(--color-bg-1);
  padding: 20px;
  box-sizing: border-box;
  border-radius: var(--border-radius-medium);
}

.uuid-generate-content-box,
.uuid-generate-content-box :deep(.arco-space-item:nth-of-type(1)),
.uuid-generate-content-box :deep(.arco-space-item:nth-of-type(3)) {
  width: 100%;
}

.uuid-generate-content-box :deep(.arco-space-item:nth-of-type(2)) {
  text-align: center;
}

#uuid-generate :deep(.arco-picker-suffix-icon) {
  height: 18px;
}
</style>
