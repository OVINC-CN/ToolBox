<script setup>
import {v1 as uuidv1, v4 as uuidv4, v7 as uuidv7} from 'uuid';
import {ref} from 'vue';
import {useI18n} from 'vue-i18n';
import {Message} from '@arco-design/web-vue';
import {useRouter} from 'vue-router';

const i18n = useI18n();

const router = useRouter();

const uuidChoices = ref(
    [
      {
        'label': i18n.t('UUIDV1'),
        'value': 1,
      },
      {
        'label': i18n.t('UUIDV4'),
        'value': 4,
      },
      {
        'label': i18n.t('UUIDV7'),
        'value': 7,
      },
    ],
);

const formRef = ref(null);
const formData = ref(
    {
      hasConnector: true,
      uuidVersion: 4,
      generateCount: 1,
    },
);

const resultVisible = ref(false);
const uuidResults = ref('');
const doGenerate = () => {
  uuidResults.value = '';
  resultVisible.value = true;
  let uuidFunc;
  switch (formData.value.uuidVersion) {
    case 1:
      uuidFunc = uuidv1;
      break;
    case 4:
      uuidFunc = uuidv4;
      break;
    case 7:
      uuidFunc = uuidv7;
      break;
    default:
      Message.error(i18n.t('UnsupportedUUIDVersion'));
  }
  const uuids = [];
  for (let i = 0; i < formData.value.generateCount; i++) {
    let uuidItem = uuidFunc();
    if (!formData.value.hasConnector) {
      uuidItem = uuidItem.replaceAll('-', '');
    }
    uuids.push(uuidItem);
  }
  uuidResults.value = uuids.join('\n');
};
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
      <a-form
        ref="formRef"
        :model="formData"
        auto-label-width
        @submit="doGenerate"
      >
        <a-form-item :label="$t('UUIDVersion')">
          <a-radio-group v-model="formData.uuidVersion">
            <a-radio
              v-for="u in uuidChoices"
              :key="u.value"
              :value="u.value"
            >
              {{ u.label }}
            </a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item :label="$t('UUIDFormat')">
          <a-radio-group v-model="formData.hasConnector">
            <a-radio :value="true">
              {{ $t('withConnector') }}
            </a-radio>
            <a-radio :value="false">
              {{ $t('withoutConnector') }}
            </a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item :label="$t('GenerateCount')">
          <a-input-number
            v-model="formData.generateCount"
            :min="1"
            :max="1000"
            hide-button
          />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button
              type="primary"
              html-type="submit"
            >
              {{ $t('GenerateUUID') }}
            </a-button>
          </a-space>
        </a-form-item>
      </a-form>
      <a-modal
        v-model:visible="resultVisible"
        width="360px"
        :closable="false"
        :footer="false"
        :esc-to-close="true"
        :body-style="{padding: '10px'}"
      >
        <a-textarea
          v-model="uuidResults"
          :auto-size="{maxRows: 10}"
        />
      </a-modal>
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
</style>
