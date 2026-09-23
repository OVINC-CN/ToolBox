import { validateRequest } from './core.js';

export function registerGenerationTool(documentContext, generate) {
  const context = documentContext.modelContext;
  if (!context?.registerTool) {
    return () => undefined;
  }
  const controller = new AbortController();
  try {
    Promise.resolve(
      context.registerTool(
        {
          name: 'generate_uuids',
          title: '生成 UUID 并更新字段说明',
          description:
            '生成 UUID v1、v4、v6 或 v7，替换页面结果列表，并显示第一条结果的字段说明。v1/v6 使用随机节点；v7 使用时间戳、序列和随机数据。所有操作仅在浏览器中完成。',
          inputSchema: {
            type: 'object',
            properties: {
              version: { type: 'integer', enum: [1, 4, 6, 7] },
              count: { type: 'integer', minimum: 1, maximum: 1000 },
            },
            required: ['version', 'count'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input) {
            const request = validateRequest(input);
            const result = generate(request);
            return {
              version: result.version,
              count: result.count,
              uuids: result.uuids,
              selectedUuid: result.uuids[0],
            };
          },
        },
        { signal: controller.signal },
      ),
    ).catch((error) => {
      console.warn('WebMCP registration unavailable:', error.message);
    });
  }
  catch (error) {
    console.warn('WebMCP registration unavailable:', error.message);
  }
  return () => controller.abort();
}
