import { genAI } from "./gemini-genai-instance.ts";
import { streamText, CoreMessage } from "npm:ai";
import { geminiModel } from "./vercel-ai.ts";
import SupabaseClient from "https://jsr.io/@supabase/supabase-js/2.44.4/src/SupabaseClient.ts";
import { Database } from "../supabase/db-types.ts";
import { getCandidateContextFromID } from "./supabase_stuff.ts";
interface ChatWithProps {
  context_text: string;
  prompt: string;
}
export async function chatWith({ context_text }: ChatWithProps) {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: `this is civilization game modelled on the kenyan political system , 
      a user has some questions about this candidate ,impersonate the candidate based on the provided context try and give answers under 
      100 words`,
    });

    const promptString = `=================== start of context ===================
  ${context_text}
  ==================== end of context ===================
  user question ==== ${prompt}
  `;

    const generationConfig = {
      temperature: 1,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 8192,
      responseMimeType: "text/plain",
    };
    const chatSession = model.startChat({
      generationConfig,
    });
    const result = await chatSession.sendMessage(promptString);
    // const result = await chatSession.sendMessageStream(promptString);

    return result;
  } catch (error) {
    console.log(
      "========================== error emssage in chatWith ======================= ",
      error?.message
    );
    console.log(
      "========================== full error in chatWith ======================= ",
      error
    );
    throw error;
  }
}

interface ChatWithVercelProps {
  messages: CoreMessage[];
  viewer_id: string;
  candidate_id: string;
  sb: SupabaseClient<Database>;
}

async function injectInitialContext({
  messages,
  sb,
  candidate_id,
}: ChatWithVercelProps): Promise<CoreMessage[]> {
  if (messages.length === 1) {
    const context_text = await getCandidateContextFromID({
      candidate_id,
      sb,
    });
    return [{ role: "system", content: context_text }, ...messages];
  }
  return messages;
}
export async function chatWithVercelSDK({
  messages,
  viewer_id,
  candidate_id,
  sb,
}: ChatWithVercelProps) {
  const crafteMessages = await injectInitialContext({
    candidate_id,
    messages,
    sb,
    viewer_id,
  });
  const result = await streamText({
    model: geminiModel,
    system: `This is civilization game modelled on the kenyan political system , 
      a user has some questions about this candidate ,impersonate the candidate based on the provided context`,
    messages: crafteMessages,

  });
  // const result_type = result.toDataStreamResponse().body?.values();
  // console.log(" ============= response data stream  ================ ", result_type);
  return result;
}
