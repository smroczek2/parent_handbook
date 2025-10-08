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
    const { vectorStoreId } = req.body;

    if (!vectorStoreId) {
      return res.status(400).json({ error: 'Missing vectorStoreId' });
    }

    const fileName = 'custom-instructions.md';

    // List files in the vector store to find custom-instructions.md
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
      return res.status(listFilesResponse.status).json({ error: 'Failed to list vector store files' });
    }

    const filesData = await listFilesResponse.json();
    let existingFileId: string | null = null;

    // Find if custom-instructions.md exists
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

    // If file doesn't exist, return success (nothing to delete)
    if (!existingFileId) {
      return res.status(200).json({
        success: true,
        message: 'No custom instructions found to delete'
      });
    }

    console.log(`Deleting custom-instructions.md (file ID: ${existingFileId}) from vector store ${vectorStoreId}`);

    // Remove from vector store
    const deleteFromVectorStoreResponse = await fetch(
      `https://api.openai.com/v1/vector_stores/${vectorStoreId}/files/${existingFileId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      }
    );

    if (!deleteFromVectorStoreResponse.ok) {
      console.error('Failed to delete file from vector store');
    }

    // Delete the file itself from OpenAI storage
    const deleteFileResponse = await fetch(
      `https://api.openai.com/v1/files/${existingFileId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        }
      }
    );

    if (!deleteFileResponse.ok) {
      console.error('Failed to delete file from storage');
    }

    console.log(`Successfully deleted custom-instructions.md from vector store ${vectorStoreId}`);

    return res.status(200).json({
      success: true,
      message: 'Custom instructions deleted successfully'
    });

  } catch (error) {
    console.error('Delete custom instructions API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
