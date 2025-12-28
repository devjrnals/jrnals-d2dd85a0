import fs from 'fs';

// Read the .env file
const envContent = fs.readFileSync('.env', 'utf8');
const envVars = {};

// Parse the .env file
console.log('Raw .env content:');
console.log(envContent);
console.log('---');

envContent.split('\n').forEach((line, index) => {
  console.log(`Line ${index}: "${line}"`);
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    console.log(`  Key: "${key}", Value parts: [${valueParts.map(v => `"${v}"`).join(', ')}]`);
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim();
      console.log(`  Set: ${key.trim()} = ${envVars[key.trim()].substring(0, 20)}...`);
    }
  }
});

const apiKey = envVars.VITE_OPENAI_API_KEY;

console.log('API Key found:', !!apiKey);
console.log('API Key starts with sk-proj:', apiKey?.startsWith('sk-proj-'));
console.log('API Key length:', apiKey?.length);

if (!apiKey) {
  console.error('❌ No API key found in .env file');
  process.exit(1);
}

if (!apiKey.startsWith('sk-proj-')) {
  console.warn('⚠️  API key does not start with "sk-proj-" - this might be an older format key');
}

// Test the API key with a simple request
async function testAPI() {
  try {
    console.log('Testing OpenAI API...');
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      console.log('✅ API key is valid! OpenAI API responded successfully.');
      const data = await response.json();
      console.log(`Available models: ${data.data?.length || 0} models`);
    } else {
      console.error('❌ API key test failed:', response.status, response.statusText);
      const errorData = await response.text();
      console.error('Error details:', errorData);
    }
  } catch (error) {
    console.error('❌ Network error testing API:', error.message);
  }
}

testAPI();
