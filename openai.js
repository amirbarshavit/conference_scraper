const OpenAI = require("openai");
const dotenv = require('dotenv');
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const askOpenAI = async (userContent,model="gpt-4o-mini") => {
  const response = await openai.chat.completions.create({
    model: model,
    messages: [
      {
        "role": "system",
        "content": "You are a helpful assistant."
      },
      {
        "role": "user",
        "content": userContent
      }
    ],
    temperature: 0,
  });
  
  return response.choices[0].message.content;
}



module.exports = {
    askModel:askOpenAI
}