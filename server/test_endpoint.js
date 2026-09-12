require('dotenv').config();
const r2 = require('./storage/r2');
const { getProject } = require('./engine/ProjectEngine');

async function testEndpoint() {
  await r2.init();
  
  const projectId = 'proj_1788797070217mx3q9';
  console.log(`Fetching project ${projectId}...`);
  const project = await getProject(projectId);
  
  if (!project) {
    console.error('Project not found locally.');
    return;
  }
  
  console.log(`Video ID (b2Key) is: ${project.videoId}`);
  
  try {
    const url = await r2.getPresignedUrl(project.videoId, 3600);
    console.log(`Generated Presigned URL: ${url}`);
    
    // Now let's try to fetch it
    console.log('Testing the generated URL with fetch...');
    const response = await fetch(url);
    console.log(`Response Status: ${response.status}`);
    if (response.status !== 200) {
      console.log(`Error Response text: ${await response.text()}`);
    } else {
      console.log('Success! Video exists.');
    }
  } catch (e) {
    console.error('Error generating or fetching URL:', e);
  }
}

testEndpoint();
