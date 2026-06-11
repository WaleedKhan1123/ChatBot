import { type NextRequest, NextResponse } from "next/server"

const API_KEY = process.env.GROQ_API_KEY

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json()

    // Add the system message at the beginning if not present
    const systemMessage = { role: "system", content: "YOU ARE MY FRIEND AND YOUR NAME IS WALEED." }
    const messagesWithSystem = [systemMessage, ...messages.filter((msg: any) => msg.role !== "system")]

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 1000,
        messages: messagesWithSystem,
        stream: true,
      }),
    })

    if (!groqResponse.ok || !groqResponse.body) {
      const errorText = await groqResponse.text()
      console.error("Groq API Error:", errorText)
      return NextResponse.json({ error: "Failed to get response from AI" }, { status: groqResponse.status })
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = groqResponse.body!.getReader()
        const decoder = new TextDecoder()
        const encoder = new TextEncoder()
        let buffer = ""

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split("\n")
            buffer = lines.pop() ?? ""

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed.startsWith("data:")) continue

              const data = trimmed.slice(5).trim()
              if (data === "[DONE]") {
                controller.close()
                return
              }

              try {
                const json = JSON.parse(data)
                const content = json.choices?.[0]?.delta?.content
                if (content) {
                  controller.enqueue(encoder.encode(content))
                }
              } catch {
                // ignore malformed chunks
              }
            }
          }
        } catch (error) {
          controller.error(error)
          return
        }

        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    })
  } catch (error) {
    console.error("API Route Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
