/* global Helia, BlockstoreCore, DatastoreCore, HeliaUnixfs */

let BASE_CID = ''; 

const AUTO_ANSWER_CID = `${BASE_CID}/ep-uncum-auto-answer.user.js`; // Replace with the actual CID of auto-answer.user.js

const statusValueEl = document.getElementById('statusValue');
const discoveredPeerCountEl = document.getElementById('discoveredPeerCount');
const connectedPeerCountEl = document.getElementById('connectedPeerCount');
const connectedPeersListEl = document.getElementById('connectedPeersList');
const logEl = document.getElementById('runningLog');
const nodeIdEl = document.getElementById('nodeId');
const contentDisplayEl = document.getElementById('contentDisplay'); // Display area for content

document.addEventListener('DOMContentLoaded', async () => {
  // Fetch BASE_CID from the src/cid.txt file
  
    const response = await fetch('src/cid.txt');
    if (!response.ok) {
      throw new Error(`Failed to load CID file: ${response.statusText}`);
    }
    BASE_CID = await response.text();
    BASE_CID = BASE_CID.trim(); 
  
  const helia = window.helia = await instantiateHeliaNode();
  window.heliaFs = await HeliaUnixfs.unixfs(helia);

  // Preload the auto-answer script into the blockstore on startup
  await preloadToBlockstore(helia.blockstore, AUTO_ANSWER_CID);

  // Initial fetch of the base CID's index.html
  await fetchContentByCid(`${BASE_CID}/index.html`);

  helia.libp2p.addEventListener('peer:discovery', (evt) => {
    window.discoveredPeers.set(evt.detail.id.toString(), evt.detail);
    addToLog(`Discovered peer ${evt.detail.id.toString()}`);
  });

  helia.libp2p.addEventListener('peer:connect', (evt) => {
    addToLog(`Connected to ${evt.detail.toString()}`);
  });

  helia.libp2p.addEventListener('peer:disconnect', (evt) => {
    addToLog(`Disconnected from ${evt.detail.toString()}`);
  });

  setInterval(() => {
    const isOnline = helia.libp2p.status === 'started';
    statusValueEl.innerHTML = isOnline ? 'Online' : 'Offline';

    // Clear previous status classes
    statusValueEl.classList.remove('online', 'offline');

    // Apply appropriate class based on status
    if (isOnline) {
      statusValueEl.classList.add('online_grn');  // Add class for online
    } else {
      statusValueEl.classList.add('offline_red'); // Add class for offline
    }

    updateConnectedPeers();
    updateDiscoveredPeers();
  }, 500);

  const id = await helia.libp2p.peerId.toString();
  nodeIdEl.innerHTML = id;
});

// Preload the auto-answer script into the blockstore
async function preloadToBlockstore(blockstore, cid) {
  try {
    const textDecoder = new TextDecoder();
    let content = '';

    // Fetch the content by CID and add it to the blockstore
    for await (const chunk of window.heliaFs.cat(cid)) {
      content += textDecoder.decode(chunk);
    }

    // Add the content to the blockstore
    await blockstore.put(cid, new TextEncoder().encode(content));
    addToLog(`Preloaded script with CID: ${cid} into blockstore`);
  } catch (error) {
    console.error(`Error preloading CID ${cid} into blockstore:`, error);
  }
}

async function fetchContentByCid(cid) {
  const textDecoder = new TextDecoder();
  contentDisplayEl.innerHTML = ''; // Clear previous content
  try {
    let content = ''; // Store the full content fetched
    for await (const data of window.heliaFs.cat(cid)) {
      content += textDecoder.decode(data);
    }

    // Check the file extension to determine if it's .js or .log
    const isJsOrTxtFile = cid.endsWith('.js') || cid.endsWith('.log') || cid.endsWith('.txt');
    if (isJsOrTxtFile) {
      createCopyableInputBox(content, cid); // Pass the CID for returning
    } else {
      displayContentAsHtml(content);
    }

    addToLog(`Fetched content for CID: ${cid}`);
  } catch (error) {
    console.error(`Error fetching CID ${cid}:`, error);
    contentDisplayEl.innerHTML = `Error fetching CID: ${error.message}`;
  }
}

function createCopyableInputBox(content, originalCid) {
  // Clear previous content
  contentDisplayEl.innerHTML = '';

  // Create a container for the input box and buttons
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.flexDirection = 'column'; // Stack children vertically
  container.style.alignItems = 'flex-start'; // Align items to the start (left)
  
  // Create a copy button
  const copyButton = document.createElement('button');
  copyButton.innerText = 'Copy to Clipboard';
  copyButton.onclick = () => {
    const tempInput = document.createElement('textarea');
    tempInput.value = content; // Set the value to the original content
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy'); // Copy the content to clipboard
    document.body.removeChild(tempInput); // Remove the temporary input

    // Show the popup message
    showCopiedMessage('Script Copied!');
  };

  // Create a return button
  const returnButton = document.createElement('button');
  returnButton.innerText = 'Return to Original Page';
  returnButton.onclick = async () => {
    await fetchContentByCid(`${BASE_CID}/index.html`); // Fetch the main page
  };

  // Create a <pre> element to preserve formatting and newlines
  const pre = document.createElement('pre');
  pre.style.whiteSpace = 'pre-wrap'; // Ensure whitespace and line breaks are preserved
  pre.style.border = '1px solid #ccc'; // Optional: add a border for aesthetics
  pre.style.padding = '10px'; // Optional: add padding for better appearance
  pre.style.backgroundColor = '#f9f9f9'; // Optional: light background color
  pre.textContent = content; // Use textContent to prevent HTML injection

  // Append the buttons first to the container, then the <pre>
  container.appendChild(copyButton);
  container.appendChild(returnButton);
  container.appendChild(pre); // Ensure content is below the buttons

  // Append the container to the content display area
  contentDisplayEl.appendChild(container);

  // Scroll to the top of the page
  window.scrollTo(0, 0);
}

// Function to show a pop-up message
function showCopiedMessage(message) {
  const messageEl = document.createElement('div');
  messageEl.innerText = message;
  messageEl.style.position = 'fixed';
  messageEl.style.bottom = '20px';
  messageEl.style.right = '20px';
  messageEl.style.backgroundColor = '#4CAF50'; // Green background
  messageEl.style.color = 'white'; // White text
  messageEl.style.padding = '10px';
  messageEl.style.borderRadius = '5px';
  messageEl.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
  messageEl.style.zIndex = '1000'; // Ensure it's on top of other elements
  document.body.appendChild(messageEl);

  // Fade out the message after 2 seconds
  setTimeout(() => {
    messageEl.style.transition = 'opacity 0.5s ease';
    messageEl.style.opacity = '0';
    setTimeout(() => document.body.removeChild(messageEl), 500); // Remove after fade
  }, 2000);
}


function displayContentAsHtml(content) {
  // Clear previous content
  contentDisplayEl.innerHTML = content; // Display HTML content normally

  // Replace local links with IPFS fetchers
  replaceLocalLinksWithIpfsFetchers(contentDisplayEl);
}

function replaceLocalLinksWithIpfsFetchers(container) {
  const links = container.querySelectorAll('a');

  links.forEach(link => {
    const originalHref = link.getAttribute('href');

    // Check if the link is a local asset
    if (originalHref && !originalHref.startsWith('http')) {
      const newCid = `${BASE_CID}/${originalHref}`; // Construct the new CID

      // Update the link to call fetchContentByCid with the new CID
      link.href = '#'; // Prevent navigation
      link.onclick = async (event) => {
        event.preventDefault(); // Prevent default behavior
        await fetchContentByCid(newCid); // Fetch the new content from IPFS
      };
    }
  });
}

function ms2TimeString(a) {
  const k = a % 1e3;
  const s = a / 1e3 % 60 | 0;
  const m = a / 6e4 % 60 | 0;
  const h = a / 36e5 % 24 | 0;

  return (h ? (h < 10 ? '0' + h : h) + ':' : '00:') +
    (m < 10 ? 0 : '') + m + ':' +
    (s < 10 ? 0 : '') + s + ':' +
    (k < 100 ? k < 10 ? '00' : 0 : '');
}

const getLogLineEl = (msg) => {
  const logLine = document.createElement('span');
  logLine.innerHTML = `${ms2TimeString(performance.now())} - ${msg}`;
  return logLine;
}

const addToLog = (msg) => {
  logEl.appendChild(getLogLineEl(msg));
}

let heliaInstance = null;
const instantiateHeliaNode = async () => {
  // application-specific data lives in the datastore
  const datastore = new DatastoreCore.MemoryDatastore();
  const blockstore = new BlockstoreCore.MemoryBlockstore();

  if (heliaInstance != null) {
    return heliaInstance;
  }

  heliaInstance = await Helia.createHelia({
    datastore,
    blockstore
  });
  addToLog('Created Helia instance');

  // Serve the content from the base CID at startup
  try {
    await fetchContentByCid(BASE_CID + '/index.html'); // Fetch and display the index.html from the base CID
  } catch (error) {
    console.error(`Failed to fetch initial content:`, error);
  }

  return heliaInstance;
}

window.discoveredPeers = new Map();

const updateConnectedPeers = () => {
  const peers = window.helia.libp2p.getPeers();
  connectedPeerCountEl.innerHTML = peers.length;
  connectedPeersListEl.innerHTML = '';
  for (const peer of peers) {
    const peerEl = document.createElement('li');
    peerEl.innerText = peer.toString();
    connectedPeersListEl.appendChild(peerEl);
  }
}

const updateDiscoveredPeers = () => {
  discoveredPeerCountEl.innerHTML = window.discoveredPeers.size;
}
