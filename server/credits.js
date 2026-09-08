const { supabase } = require('./supabase');

async function checkCredits(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('credits, videos_used')
    .eq('id', userId)
    .single();
    
  if (error) {
    console.error('Error fetching credits:', error);
    return null;
  }
  return data;
}

async function deductCredits(userId, amount) {
  // Use read-modify-write within a transaction or atomic update if possible.
  // Since supabase JS client lacks atomic increment without RPC, we read then update.
  const { data, error } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', userId)
    .single();
    
  if (!error && data) {
    const newCredits = data.credits - amount;
    await supabase
      .from('profiles')
      .update({ credits: newCredits })
      .eq('id', userId);
  }
}

async function addCredits(userId, amount) {
  const { data, error } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', userId)
    .single();
    
  if (!error && data) {
    const newCredits = data.credits + amount;
    await supabase
      .from('profiles')
      .update({ credits: newCredits })
      .eq('id', userId);
  }
}

async function incrementVideosUsed(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('videos_used')
    .eq('id', userId)
    .single();
    
  if (!error && data) {
    const newCount = (data.videos_used || 0) + 1;
    await supabase
      .from('profiles')
      .update({ videos_used: newCount })
      .eq('id', userId);
  }
}

module.exports = { checkCredits, deductCredits, addCredits, incrementVideosUsed };
