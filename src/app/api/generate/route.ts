import { NextRequest } from 'next/server';
import { cleanText } from '@/lib/preprocessor';
import { analyzeNovel, generateOutline, generateScript, LLMConfig } from '@/lib/llm';
import { GenerateRequest } from '@/lib/types';

function extractLLMConfig(request: NextRequest): LLMConfig {
  return {
    apiKey: request.headers.get('x-api-key') || undefined,
    baseUrl: request.headers.get('x-base-url') || undefined,
    modelName: request.headers.get('x-model-name') || undefined,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();
    const llmConfig = extractLLMConfig(request);

    if (!body.text || !body.genre || !body.config) {
      return new Response(
        JSON.stringify({ error: '缺少必要参数' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const send = (data: object) => {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
            );
          };

          // Step 1: 预处理
          send({ step: 'preprocessing', message: '正在预处理文本...' });
          const cleanedText = cleanText(body.text);
          const textForAnalysis = cleanedText.slice(0, 8000);

          // Step 2: 分析
          let analysisJson: string;
          if (body.analysis) {
            analysisJson = JSON.stringify(body.analysis);
            send({ step: 'analyzing', message: '使用已有分析结果...' });
          } else {
            send({ step: 'analyzing', message: '正在分析小说内容（角色、情节、冲突点）...' });
            analysisJson = await analyzeNovel(textForAnalysis, body.genre, llmConfig);
            send({ step: 'analyzed', message: '分析完成', data: analysisJson });
          }

          // Step 3: 大纲
          send({ step: 'outlining', message: '正在生成分集大纲...' });
          const outlineJson = await generateOutline(
            analysisJson,
            body.genre,
            body.config.episodeCount,
            llmConfig
          );
          send({ step: 'outlined', message: '大纲生成完成', data: outlineJson });

          // Step 4: 逐集生成剧本
          const episodeCount = body.config.episodeCount;
          for (let ep = 1; ep <= episodeCount; ep++) {
            send({
              step: 'generating',
              message: `正在生成第 ${ep}/${episodeCount} 集剧本...`,
              episode: ep,
            });

            let scriptContent = '';
            for await (const chunk of generateScript(
              outlineJson,
              analysisJson,
              body.genre,
              ep,
              llmConfig
            )) {
              scriptContent += chunk;
              send({
                step: 'streaming',
                episode: ep,
                chunk,
                content: scriptContent,
              });
            }

            send({
              step: 'episode_done',
              episode: ep,
              content: scriptContent,
            });
          }

          // Step 5: 完成
          send({ step: 'done', message: '全部剧本生成完成！' });
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                step: 'error',
                message: error instanceof Error ? error.message : '生成过程出错，请检查 API 配置',
              })}\n\n`
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Generate error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : '生成失败',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
