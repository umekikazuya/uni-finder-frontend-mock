import type { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  const { query } = await request.json()

  // Create a readable stream for Server-Sent Events
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      const generateAIResponse = (userQuery: string): string => {
        // Simple mock AI responses based on query content
        if (userQuery.includes("定例") || userQuery.includes("会議")) {
          return `最近の内部定例についてお答えします。

2024年度Q1の定例会議では、以下の重要な決定がありました：

**主要な決定事項：**
• 新しい製品コンセプト「Clue.ai」の正式承認
• マーケティング予算を前年比30%増額
• 開発チームの体制を3チーム制に変更

**技術的な決定：**
• React + TypeScriptでのフロントエンド統一
• AIチャット機能の優先実装
• セキュリティ監査の四半期実施

これらの決定により、今四半期の開発方針が明確になりました。特にUI/UXの改善が重要な課題として挙げられています。`
        }

        if (userQuery.includes("技術") || userQuery.includes("開発")) {
          return `技術・開発に関する情報をお調べしました。

**現在の技術スタック：**
• フロントエンド: React, TypeScript, Tailwind CSS
• バックエンド: Next.js API Routes
• データベース: PostgreSQL
• インフラ: Vercel

**最新の技術決定：**
• shadcn/uiの採用を見送り、Tailwindのみでの実装
• Server-Sent Eventsを使用したリアルタイム通信
• ローカルストレージでの状態管理

**今後の予定：**
• AIモデルの統合（GPT-4o予定）
• データベース連携の実装
• パフォーマンス最適化`
        }

        // Default response
        return `ご質問「${userQuery}」についてお答えします。

申し訳ございませんが、この質問に対する具体的な情報が見つかりませんでした。

**検索のヒント：**
• より具体的なキーワードを使用してください
• 「定例」「会議」「技術」「開発」などの関連語句を含めてみてください
• 時期を指定すると、より正確な情報が得られます

他にご質問がございましたら、お気軽にお聞きください。`
      }

      const aiResponse = generateAIResponse(query)
      const words = aiResponse.split("")
      let currentIndex = 0

      const streamResponse = () => {
        if (currentIndex < words.length) {
          const char = words[currentIndex]
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                content: char,
                type: "stream",
              })}\n\n`,
            ),
          )
          currentIndex++

          const delay = char === "\n" ? 100 : Math.random() * 50 + 20
          setTimeout(streamResponse, delay)
        } else {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "complete",
              })}\n\n`,
            ),
          )
          controller.close()
        }
      }

      setTimeout(streamResponse, 500)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
