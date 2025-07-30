import { type NextRequest, NextResponse } from "next/server"

const API_KEY = "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"

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json()

    // Add the system message at the beginning if not present
    const systemMessage = { role: "system", content: "YOU ARE MY FRIEND AND YOUR NAME IS WALEED." }
    const messagesWithSystem = [systemMessage, ...messages.filter((msg: any) => msg.role !== "system")]

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://yourdomain.com",
        "X-Title": "ConsoleBot",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        max_tokens: 1000,
        messages: messagesWithSystem,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("OpenRouter API Error:", errorText)
      return NextResponse.json({ error: "Failed to get response from AI" }, { status: response.status })
    }

    const data = await response.json()

    // Extract the assistant's reply
    const assistantReply = data.choices?.[0]?.message?.content

    if (!assistantReply) {
      console.error("No content in response:", data)
      return NextResponse.json({ error: "No response content received" }, { status: 500 })
    }

    return NextResponse.json({ content: assistantReply })
  } catch (error) {
    console.error("API Route Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
