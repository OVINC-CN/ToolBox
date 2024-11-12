<script setup>
import {computed, onMounted, onUnmounted, ref, watch} from 'vue';
import {useI18n} from 'vue-i18n';
import {QCloudCredentialStorageKey} from '../../constants';
import {handleLoading} from '../../utils/loading';
import {createPurgeTaskAPI, describeZonesAPI} from '../../api/tcloud';
import {Message} from '@arco-design/web-vue';
import {checkResponse} from '../../utils/tcloud';
import {splitTextIntoArray} from '../../utils/tools';
import {useRouter} from 'vue-router';

// international
const i18n = useI18n();

// router
const router = useRouter();

// credentials
const credentials = ref([]);
onMounted(() => {
  try {
    credentials.value = JSON.parse(localStorage.getItem(QCloudCredentialStorageKey)) || [];
  } catch (_) {}
});
watch(() => credentials.value.length, () => {
  localStorage.setItem(QCloudCredentialStorageKey, JSON.stringify(credentials.value));
});

// credential edit
const createCredentialVisible = ref(false);
const createCredentialParams = ref({
  secretID: '',
  secretKey: '',
});
const createCredentialRules = ref(
    {
      secretID: [{required: true, message: i18n.t('SecretIDRequired')}],
      secretKey: [{required: true, message: i18n.t('SecretKeyRequired')}],
    },
);
const showCreateCredential = () => {
  createCredentialParams.value = {
    secretID: '',
    secretKey: '',
  };
  createCredentialVisible.value = true;
};
const storeCredential = ({errors}) => {
  if (errors) {
    return;
  }
  createCredentialVisible.value = false;
  credentials.value.push(JSON.parse(JSON.stringify(createCredentialParams.value)));
  formData.value.credential = `${createCredentialParams.value.secretID}:${createCredentialParams.value.secretKey}`;
};
const deleteCredential = () => {
  const secretID = formData.value.credential.split(':')[0];
  credentials.value = credentials.value.filter((c) => c.secretID !== secretID);
  formData.value.credential = '';
};

// form data
const formRef = ref(null);
const formData = ref(
    {
      credential: '',
      zoneID: '',
      refreshType: 'purge_url',
      method: 'invalidate',
      targets: '',
    },
);
const formRules = ref(
    {
      credential: [
        {
          required: true,
          message: i18n.t('CredentialRequired'),
        },
      ],
      zoneID: [
        {
          required: true,
          message: i18n.t('ZoneRequired'),
        },
      ],
      refreshType: [
        {
          required: true,
          message: i18n.t('RefreshTypeRequired'),
        },
      ],
      method: [
        {
          required: true,
          message: i18n.t('RefreshMethodRequired'),
        },
      ],
      targets: [
        {
          validator: (value, cb) => {
            value = splitTextIntoArray(value);
            if (formData.value.refreshType !== 'purge_all' && value.length === 0) {
              cb(i18n.t('RefreshTargetsRequired'));
            }
            for (const i of value) {
              if (
                (
                  (formData.value.refreshType === 'purge_url' || formData.value.refreshType === 'purge_prefix') &&
                      (i.indexOf('http://') !== 0 && i.indexOf('https://') !== 0)
                )
              ) {
                cb(i18n.t('TargetURLInvalid'));
              } else if (
                formData.value.refreshType === 'purge_host' &&
                  (i.indexOf('http://') === 0 || i.indexOf('https://') === 0)
              ) {
                cb(i18n.t('TargetHostInvalid'));
              }
            }
            cb();
          },
        },
      ],
    },
);

// form style
const windowWidth = ref(window.innerWidth);
onMounted(() => window.addEventListener('resize', () => windowWidth.value = window.innerWidth));
onUnmounted(() => window.removeEventListener('resize', () => {}));
const formLayout = computed(() => {
  return windowWidth.value > 800 ? 'horizontal' : 'vertical';
});

// zones
const zones = ref([]);
const zonesLoading = ref(false);
const loadZones = () => {
  handleLoading(zonesLoading, true);
  const secretParams = formData.value.credential.split(':');
  describeZonesAPI(
      ...secretParams,
      {
        Limit: 100,
        Order: 'zone-name',
        Direction: 'asc',
      },
  ).then(
      (res) => {
        if (checkResponse(res)) {
          zones.value = res.Response.Zones;
        }
      },
      (err) => Message.error(err),
  ).finally(() => {
    handleLoading(zonesLoading, false);
  });
};
watch(() => formData.value.credential, () => {
  if (formData.value.credential) {
    loadZones();
  }
});

// refresh type
const refreshType = ref(
    [
      {
        label: i18n.t('RefreshURL'),
        value: 'purge_url',
      },
      {
        label: i18n.t('RefreshDirectory'),
        value: 'purge_prefix',
      },
      {
        label: i18n.t('RefreshHostname'),
        value: 'purge_host',
      },
      {
        label: i18n.t('RefreshAllCache'),
        value: 'purge_all',
      },
    ],
);

// refresh method
const refreshMethod = ref(
    [
      {
        label: i18n.t('Invalidate'),
        value: 'invalidate',
      },
      {
        label: i18n.t('Delete'),
        value: 'delete',
      },
    ],
);

// do refresh
const refreshLoading = ref(false);
const submitRefresh = ({errors}) => {
  if (errors) {
    return;
  }
  handleLoading(refreshLoading, true);
  const secretParams = formData.value.credential.split(':');
  createPurgeTaskAPI(
      ...secretParams,
      {
        ZoneId: formData.value.zoneID,
        Type: formData.value.refreshType,
        Method: formData.value.method,
        Targets: splitTextIntoArray(formData.value.targets),
      },
  ).then(
      (res) => {
        if (checkResponse(res)) {
          formData.value.targets = '';
          Message.success(i18n.t('RefreshSuccessWithJobID', {taskID: res.Response.JobId}));
        }
      },
      (err) => Message.error(err),
  ).finally(() => {
    handleLoading(refreshLoading, false);
  });
};
</script>

<template>
  <a-layout id="teo-refresh">
    <div id="teo-refresh-content">
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
        :rules="formRules"
        :layout="formLayout"
        @submit="submitRefresh"
        :disabled="refreshLoading"
      >
        <a-form-item
          :label="$t('QCloudCredential')"
          field="credential"
        >
          <div style="width: 100%; display: flex;">
            <a-select
              v-model="formData.credential"
              style="width: calc(100% - 42px); margin-right: 10px"
            >
              <a-option
                v-for="c in credentials"
                :key="c.secretID"
                :value="`${c.secretID}:${c.secretKey}`"
                :label="c.secretID"
              />
            </a-select>
            <a-trigger position="top">
              <template #content>
                <div class="trigger-content">
                  {{ $t('DeleteCredential') }}
                </div>
              </template>
              <a-button
                @click="deleteCredential"
                v-if="formData.credential"
                style="margin-right: 10px"
                v-show="false"
              >
                <template #icon>
                  <icon-delete />
                </template>
              </a-button>
            </a-trigger>
            <a-trigger position="top">
              <template #content>
                <div class="trigger-content">
                  {{ $t('AddCredential') }}
                </div>
              </template>
              <a-button @click="showCreateCredential">
                <template #icon>
                  <icon-plus />
                </template>
              </a-button>
            </a-trigger>
          </div>
        </a-form-item>
        <a-form-item
          :label="$t('TEOZone')"
          field="zoneID"
        >
          <a-select
            :loading="zonesLoading"
            v-model="formData.zoneID"
          >
            <a-option
              v-for="z in zones"
              :key="z.ZoneId"
              :label="z.ZoneName"
              :value="z.ZoneId"
            />
          </a-select>
        </a-form-item>
        <a-form-item
          :label="$t('RefreshType')"
          field="refreshType"
        >
          <a-select
            v-model="formData.refreshType"
          >
            <a-option
              v-for="t in refreshType"
              :key="t.value"
              :label="t.label"
              :value="t.value"
            />
          </a-select>
        </a-form-item>
        <a-form-item
          :label="$t('RefreshMethod')"
          field="refreshMethod"
          v-show="formData.refreshType !== 'purge_url'"
        >
          <a-select
            v-model="formData.method"
          >
            <a-option
              v-for="t in refreshMethod"
              :key="t.value"
              :label="t.label"
              :value="t.value"
            />
          </a-select>
        </a-form-item>
        <a-form-item
          :label="$t('RefreshTargets')"
          field="targets"
          v-show="formData.refreshType !== 'purge_all'"
        >
          <a-textarea
            v-model="formData.targets"
            :auto-size="{minRows: 3, maxRows: 10}"
          />
        </a-form-item>
        <a-form-item style="margin-bottom: 0">
          <a-space>
            <a-button
              type="primary"
              html-type="submit"
            >
              {{ $t('SubmitTask') }}
            </a-button>
            <a-button @click="$refs.formRef.resetFields()">
              {{ $t('ResetForm') }}
            </a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </div>
    <a-modal
      v-model:visible="createCredentialVisible"
      width="360px"
      :closable="false"
      :footer="false"
      :esc-to-close="true"
    >
      <a-form
        :model="createCredentialParams"
        @submit="storeCredential"
        auto-label-width
        :rules="createCredentialRules"
        :layout="formLayout"
      >
        <a-form-item
          :label="$t('QCloudSecretID')"
          field="secretID"
        >
          <a-input v-model="createCredentialParams.secretID" />
        </a-form-item>
        <a-form-item
          :label="$t('QCloudSecretKey')"
          field="secretKey"
        >
          <a-input v-model="createCredentialParams.secretKey" />
        </a-form-item>
        <a-form-item style="margin-bottom: 0">
          <a-space>
            <a-button
              type="primary"
              html-type="submit"
            >
              {{ i18n.t('Save') }}
            </a-button>
            <a-button @click="createCredentialVisible=false">
              {{ i18n.t('Cancel') }}
            </a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-modal>
  </a-layout>
</template>

<style scoped>
#teo-refresh {
  height: 100%;
  width: 100%;
  justify-content: center;
  align-items: center;
  background-image: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

#teo-refresh-content {
  min-width: 320px;
  width: 90vw;
  max-width: 800px;
  background: var(--color-bg-1);
  padding: 20px;
  box-sizing: border-box;
  border-radius: var(--border-radius-medium);
}

.trigger-content {
  background: var(--color-neutral-3);
  padding: 10px;
  box-sizing: border-box;
  margin-bottom: 10px;
}
</style>
