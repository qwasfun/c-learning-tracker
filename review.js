import { Octokit } from "@octokit/rest";
import OpenAI from "openai";

// 从环境变量读取
const githubToken = process.env.GITHUB_TOKEN;
const openaiApiKey = process.env.OPENAI_API_KEY;
const issueNumber = process.env.ISSUE_NUMBER;
const commentBody = process.env.COMMENT_BODY;
const repo = process.env.REPO;

if (!githubToken || !openaiApiKey || !issueNumber || !commentBody || !repo) {
  console.error("缺少必要环境变量！");
  process.exit(1);
}

const octokit = new Octokit({ auth: githubToken });
const openai = new OpenAI({
  apiKey: openaiApiKey,
  baseURL: "https://openrouter.ai/api/v1",
});

// 简单提取 Markdown 代码块（只提取第一个）
function extractCodeBlock(text) {
  const regex = /```(?:\w*\n)?([\s\S]*?)```/;
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

async function run() {
  try {
    const code = extractCodeBlock(commentBody);

    if (!code) {
      console.log("Issue 内容中未找到代码块，跳过 review。");
      return;
    }
    if (code <= 100) {
      console.log("Issue 内容中内容太短，跳过 review。");
      return;
    }

    console.log("提取到代码：", code.substring(0, 100) + "...");

    // 调用 OpenAI ChatGPT 做代码 review
    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: "你是一位经验丰富的代码审核专家，语气直白、鼓励、善于交谈。",
        },
        {
          role: "user",
          content: `请帮我 review 下面这段代码，指出逻辑、风格或可优化的问题，并给出建议，语言直白，鼓励为主：\n\n${code}`,
        },
      ],
      max_tokens: 2000,
    });

    const review = response.choices[0].message.content;

    console.log("Review 结果：", review);

    // 发布评论到 Issue
    const [owner, repoName] = repo.split("/");

    await octokit.issues.createComment({
      owner,
      repo: repoName,
      issue_number: Number(issueNumber),

      body: `### 🤖 自动代码 Review 结果\n\n${review}`,
    });

    console.log("Review 评论已发布！");
  } catch (err) {
    console.error("执行出错：", err);
    process.exit(1);
  }
}

run();
