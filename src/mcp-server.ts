case 'prowlarr_vpn_status': {
  const vpnManager = intelligentSearchManager.getVPNManager();
  const vpnStatus = await vpnManager.getVPNStatus();
  
  let statusText = '🌐 **VPN Status**\n\n';
  
  if (vpnStatus.needsLogin) {
    statusText += `❌ **Not Authenticated**\n`;
    statusText += `🔑 **Action Required:** VPN needs authentication\n\n`;
    
    // Try to get login URL
    const authCheck = await vpnManager.checkAuthentication();
    if (authCheck.loginUrl) {
      statusText += `🔗 **Login URL:** ${authCheck.loginUrl}\n\n`;
      statusText += `📝 **Steps to authenticate:**\n`;
      statusText += `1. Open the URL above in your browser\n`;
      statusText += `2. Log in with your NordVPN credentials\n`;
      statusText += `3. Return here and try again\n\n`;
      statusText += `💡 **Tip:** Authentication persists across container restarts`;
    } else {
      statusText += `🔗 **To get login URL:** Run \`docker exec nordvpn_official nordvpn login\``;
    }
  } else if (vpnStatus.connected) {
    statusText += `✅ **Connected**\n`;
    statusText += `📍 **Location:** ${vpnStatus.city}, ${vpnStatus.country}\n`;
    statusText += `🌍 **IP:** ${vpnStatus.ip}\n`;
    if (vpnStatus.connectionTime) {
      statusText += `⏰ **Connected Since:** ${vpnStatus.connectionTime.toLocaleString()}\n`;
    }
    statusText += `\n⏳ **Auto-disconnect:** Will disconnect after 10 minutes of inactivity`;
  } else {
    statusText += `❌ **Disconnected**\n`;
    statusText += `✅ **Authenticated:** Ready to connect\n`;
    statusText += `💡 **Tip:** VPN will auto-connect when needed for searches`;
  }
  
  return {
    content: [
      {
        type: 'text',
        text: statusText,
      },
    ],
  };
}

case 'prowlarr_vpn_connect': {
  const city = (args?.city as string) || 'australia';
  const vpnManager = intelligentSearchManager.getVPNManager();
  
  // Check authentication first
  const vpnStatus = await vpnManager.getVPNStatus();
  if (vpnStatus.needsLogin) {
    const authCheck = await vpnManager.checkAuthentication();
    let errorMessage = `❌ **VPN Not Authenticated**\n\n`;
    errorMessage += `🔑 **Please authenticate first:**\n`;
    
    if (authCheck.loginUrl) {
      errorMessage += `🔗 **Login URL:** ${authCheck.loginUrl}\n\n`;
      errorMessage += `📝 **Steps:**\n`;
      errorMessage += `1. Open the URL above in browser\n`;
      errorMessage += `2. Log in with NordVPN credentials\n`;
      errorMessage += `3. Try connecting again`;
    } else {
      errorMessage += `Run: \`docker exec nordvpn_official nordvpn login\``;
    }
    
    return {
      content: [
        {
          type: 'text',
          text: errorMessage,
        },
      ],
    };
  }
  
  const result = await vpnManager.connectVPN(city);
  
  return {
    content: [
      {
        type: 'text',
        text: result.success 
          ? `✅ **VPN Connected Successfully!**\n\n${result.message}\n\n⏰ **Auto-disconnect:** Will disconnect in 10 minutes`
          : `❌ **VPN Connection Failed**\n\n${result.message}`,
      },
    ],
  };
} 