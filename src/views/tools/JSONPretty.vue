<script setup>
import VueJsonPretty from 'vue-json-pretty';
import 'vue-json-pretty/lib/styles.css';
import {ref} from 'vue';
import {useRouter} from 'vue-router';

const router = useRouter();

const jsonStrData = ref('');
const onJsonStrDataChange = (val) => {
  try {
    jsonData.value = JSON.parse(val);
  } catch (e) {
    jsonData.value = {'error': String(e)};
  }
};
const jsonData = ref({});

const editJsonStrVisible = ref(false);
const jsonStrDataEdit = ref('');
const showEditJsonStr = () => {
  editJsonStrVisible.value = true;
  jsonStrDataEdit.value = JSON.stringify(jsonData.value, null, 4);
};
const onEditJsonStrClose =() =>{
  jsonStrData.value = jsonStrDataEdit.value;
  onJsonStrDataChange(jsonStrData.value);
};
</script>

<template>
  <a-layout id="json-pretty">
    <div id="json-pretty-content">
      <a-space>
        <a-link @click="router.push({name: 'Home'})">
          <a-space>
            <icon-left />
            <span>
              {{ $t('BackHome') }}
            </span>
          </a-space>
        </a-link>
        <a-link
          @click="showEditJsonStr"
          v-if="jsonStrData"
        >
          <icon-edit />
          <span>
            {{ $t('EditData') }}
          </span>
        </a-link>
      </a-space>
      <a-divider />
      <a-space
        direction="vertical"
        class="json-pretty-content-box"
      >
        <a-input
          v-if="!jsonStrData"
          v-model="jsonStrData"
          @input="onJsonStrDataChange"
          @change="onJsonStrDataChange"
        />
        <vue-json-pretty
          v-else
          :data="jsonData"
          style="height: 360px; overflow-y: auto; overflow-x: auto"
          editable
          editable-trigger="dblclick"
          show-length
          show-line-number
        />
      </a-space>
    </div>
    <a-modal
      v-model:visible="editJsonStrVisible"
      width="90vw"
      :closable="false"
      :footer="false"
      :esc-to-close="true"
      :modal-style="{minWidth: '320px', maxWidth: '800px'}"
      :body-style="{padding: '10px', height: '360px', overflow: 'hidden'}"
      @close="onEditJsonStrClose"
    >
      <a-textarea
        v-model="jsonStrDataEdit"
        style="width: 100%; height: 100%"
      />
    </a-modal>
  </a-layout>
</template>

<style scoped>

#json-pretty {
  height: 100%;
  width: 100%;
  justify-content: center;
  align-items: center;
  background-image: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

#json-pretty-content {
  min-width: 320px;
  width: 90vw;
  max-width: 800px;
  background: var(--color-bg-1);
  padding: 20px;
  box-sizing: border-box;
  border-radius: var(--border-radius-medium);
}

.json-pretty-content-box {
  width: 100%;
}

:deep(.vjs-tree-node) span:nth-of-type(3),
:deep(.vjs-tree-node) span:nth-of-type(3) > span,
:deep(.vjs-tree-node) span:nth-of-type(3) > span > input {
  width: 100%;
}
</style>
