async function activateBot() {
  const number = document.getElementById('number').value.trim();
  const password = document.getElementById('password').value.trim();
  const statusDiv = document.getElementById('status');

  if (!number || !password) {
    statusDiv.innerHTML = "⚠️ Please enter both number and password.";
    return;
  }

  statusDiv.innerHTML = "⏳ Activating bot...";

  try {
    const response = await fetch('/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number, password })
    });

    const data = await response.json();

    if (data.success) {
      statusDiv.innerHTML = "✅ Bot activated successfully!";
    } else {
      statusDiv.innerHTML = "❌ Activation failed: " + data.message;
    }
  } catch (err) {
    statusDiv.innerHTML = "❌ Error activating bot.";
    console.error(err);
  }
}
