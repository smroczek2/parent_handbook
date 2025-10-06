import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const { vectorStoreId, customInstructions } = req.body;

    if (!vectorStoreId || !customInstructions) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create a file object from the custom instructions text
    const fileContent = customInstructions;
    const fileName = 'custom-instructions.md';

    // First, check if custom-instructions.md already exists in the vector store
    // We'll need to list files in the vector store
    const listFilesResponse = await fetch(
      `https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      }
    );

    if (!listFilesResponse.ok) {
      console.error('Failed to list vector store files');
    }

    let existingFileId: string | null = null;

    if (listFilesResponse.ok) {
      const filesData = await listFilesResponse.json();

      // Find if custom-instructions.md already exists
      for (const vectorFile of filesData.data || []) {
        // Get the file details to check its name
        const fileDetailResponse = await fetch(
          `https://api.openai.com/v1/files/${vectorFile.id}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`
            }
          }
        );

        if (fileDetailResponse.ok) {
          const fileDetail = await fileDetailResponse.json();
          if (fileDetail.filename === fileName) {
            existingFileId = vectorFile.id;
            break;
          }
        }
      }
    }

    // If file exists, delete it first
    if (existingFileId) {
      console.log(`Deleting existing custom-instructions.md (file ID: ${existingFileId})`);

      // Remove from vector store
      await fetch(
        `https://api.openai.com/v1/vector_stores/${vectorStoreId}/files/${existingFileId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'OpenAI-Beta': 'assistants=v2'
          }
        }
      );

      // Delete the file itself
      await fetch(`https://api.openai.com/v1/files/${existingFileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        }
      });
    }

    // Create a new file with the custom instructions
    const formData = new FormData();
    const blob = new Blob([fileContent], { type: 'text/markdown' });
    formData.append('file', blob, fileName);
    formData.append('purpose', 'assistants');

    const uploadResponse = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: formData
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('File upload error:', errorText);
      return res.status(uploadResponse.status).json({ error: 'Failed to upload file' });
    }

    const uploadData = await uploadResponse.json();
    const fileId = uploadData.id;

    console.log(`Uploaded new custom-instructions.md (file ID: ${fileId})`);

    // Add the file to the vector store
    const addToVectorStoreResponse = await fetch(
      `https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2'
        },
        body: JSON.stringify({
          file_id: fileId
        })
      }
    );

    if (!addToVectorStoreResponse.ok) {
      const errorText = await addToVectorStoreResponse.text();
      console.error('Failed to add file to vector store:', errorText);
      return res.status(addToVectorStoreResponse.status).json({
        error: 'Failed to add file to vector store'
      });
    }

    console.log(`Added custom-instructions.md to vector store ${vectorStoreId}`);

    return res.status(200).json({
      success: true,
      message: 'Custom instructions uploaded successfully',
      fileId: fileId
    });

  } catch (error) {
    console.error('Upload custom instructions API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
