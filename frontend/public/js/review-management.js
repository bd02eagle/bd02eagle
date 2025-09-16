// API Configuration - Use relative URL to avoid CORS issues
const API_BASE = '/api';

// Review Management JavaScript
let authToken = localStorage.getItem('authToken');
let allTags = [];
let filteredTags = [];
let currentTag = null;
let selectedAction = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
  if (!authToken) {
    window.location.href = '/';
    return;
  }

  initializeEventListeners();
  loadTagsForReview();
});

function initializeEventListeners() {
  // Search and filter
  document.getElementById('search-input').addEventListener('input', filterTags);
  document.getElementById('status-filter').addEventListener('change', filterTags);

  // Modal controls
  document.querySelector('.close-modal').addEventListener('click', closeModal);
  document.getElementById('cancel-review').addEventListener('click', closeModal);
  document.getElementById('submit-review').addEventListener('click', submitReview);

  // Action buttons
  document.getElementById('approve-btn').addEventListener('click', () => selectAction('APPROVE'));
  document.getElementById('request-changes-btn').addEventListener('click', () => selectAction('REQUEST_CHANGES'));

  // Close modal on background click
  document.getElementById('review-modal').addEventListener('click', function(e) {
    if (e.target === this) {
      closeModal();
    }
  });
}

async function loadTagsForReview() {
  try {
    showLoading();

    // Fetch game assignments for the logged-in user first
    const assignmentsResponse = await fetch(`${API_BASE}/assignments/my-assignments`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (!assignmentsResponse.ok) throw new Error('Failed to fetch assignments');
    const assignments = await assignmentsResponse.json();

    // Get the assigned game IDs
    const assignedGameIds = assignments.map(assignment => assignment.gameId);

    if (assignedGameIds.length === 0) {
      allTags = [];
      filteredTags = [];
      renderTags();
      updateStats();
      return;
    }

    // Fetch all games and filter to only assigned games
    const gamesResponse = await fetch(`${API_BASE}/games`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (!gamesResponse.ok) throw new Error('Failed to fetch games');
    const allGames = await gamesResponse.json();
    const assignedGames = allGames.filter(game => assignedGameIds.includes(game.id));

    allTags = [];

    // For each assigned game, get events and their tags
    for (const game of assignedGames) {
      const eventsResponse = await fetch(`${API_BASE}/games/${game.id}/events`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (eventsResponse.ok) {
        const events = await eventsResponse.json();

        for (const event of events) {
          const tagsResponse = await fetch(`${API_BASE}/events/${event.id}/tags`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          });

          if (tagsResponse.ok) {
            const tags = await tagsResponse.json();

            // Add game and event info to each tag
            tags.forEach(tag => {
              tag.game = game;
              tag.event = event;
              tag.status = getTagStatus(tag);
            });

            allTags.push(...tags);
          }
        }
      }
    }

    filteredTags = [...allTags];
    renderTags();
    updateStats();

  } catch (error) {
    console.error('Error loading tags:', error);
    showError('Failed to load tags for review');
  }
}

function getTagStatus(tag) {
  if (!tag.analystActions || tag.analystActions.length === 0) {
    return 'pending';
  }

  const latestAction = tag.analystActions[tag.analystActions.length - 1];
  return latestAction.action === 'APPROVE' ? 'approved' : 'changes_requested';
}

function filterTags() {
  const searchTerm = document.getElementById('search-input').value.toLowerCase();
  const statusFilter = document.getElementById('status-filter').value;

  filteredTags = allTags.filter(tag => {
    // Text search
    const matchesSearch = !searchTerm || 
      tag.label.toLowerCase().includes(searchTerm) ||
      tag.game.homeTeam.name.toLowerCase().includes(searchTerm) ||
      tag.game.awayTeam.name.toLowerCase().includes(searchTerm) ||
      tag.event.type.toLowerCase().includes(searchTerm) ||
      (tag.notes && tag.notes.toLowerCase().includes(searchTerm));

    // Status filter
    const matchesStatus = statusFilter === 'all' || tag.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  renderTags();
}

function renderTags() {
  const container = document.getElementById('tags-container');

  if (filteredTags.length === 0) {
    container.innerHTML = '<div class="loading">No tags found</div>';
    return;
  }

  container.innerHTML = filteredTags.map(tag => `
    <div class="tag-row">
      <div>
        <div class="tag-label">${escapeHtml(tag.label)}</div>
        ${tag.notes ? `<div class="tag-notes">${escapeHtml(tag.notes)}</div>` : ''}
      </div>
      <div>${escapeHtml(tag.game.homeTeam.name)} vs. ${escapeHtml(tag.game.awayTeam.name)}</div>
      <div>
        <div>${escapeHtml(tag.event.type)}</div>
        <div style="font-size: 12px; color: #6B7280;">${formatTimestamp(tag.event.timestampMs)}</div>
      </div>
      <div>${tag.createdBy ? 'Charter' : 'System'}</div>
      <div>
        <span class="status-badge status-${tag.status}">
          ${formatStatus(tag.status)}
        </span>
      </div>
      <div class="action-buttons">
        <button class="review-btn primary" onclick="openReviewModal('${tag.id}')">
          Review
        </button>
      </div>
    </div>
  `).join('');
}

function updateStats() {
  const pendingCount = allTags.filter(tag => tag.status === 'pending').length;
  const approvedCount = allTags.filter(tag => tag.status === 'approved').length;
  const changesCount = allTags.filter(tag => tag.status === 'changes_requested').length;

  document.getElementById('pending-count').textContent = pendingCount;
  document.getElementById('approved-count').textContent = approvedCount;
  document.getElementById('changes-count').textContent = changesCount;
}

function openReviewModal(tagId) {
  currentTag = allTags.find(tag => tag.id === tagId);
  if (!currentTag) return;

  // Populate modal
  document.getElementById('modal-label').textContent = currentTag.label;
  document.getElementById('modal-notes').textContent = currentTag.notes || 'No notes';
  document.getElementById('modal-created').textContent = formatDate(currentTag.createdAt);

  // Reset form
  selectedAction = null;
  document.getElementById('analyst-comment').value = '';
  document.querySelectorAll('.action-btn').forEach(btn => btn.classList.remove('selected'));

  // Show modal
  document.getElementById('review-modal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('review-modal').style.display = 'none';
  currentTag = null;
  selectedAction = null;
}

function selectAction(action) {
  selectedAction = action;

  // Update UI
  document.querySelectorAll('.action-btn').forEach(btn => btn.classList.remove('selected'));

  if (action === 'APPROVE') {
    document.getElementById('approve-btn').classList.add('selected');
  } else {
    document.getElementById('request-changes-btn').classList.add('selected');
  }
}

async function submitReview() {
  if (!currentTag || !selectedAction) {
    alert('Please select an action');
    return;
  }

  try {
    const comment = document.getElementById('analyst-comment').value;

    const response = await fetch(`${API_BASE}/tags/${currentTag.id}/analyst-actions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: selectedAction,
        comment: comment || null
      })
    });

    if (!response.ok) {
      throw new Error('Failed to submit review');
    }

    const analystAction = await response.json();

    // Update local data
    if (!currentTag.analystActions) currentTag.analystActions = [];
    currentTag.analystActions.push(analystAction);
    currentTag.status = getTagStatus(currentTag);

    // Refresh UI
    filterTags();
    updateStats();
    closeModal();

    showSuccessMessage('Review submitted successfully!');

  } catch (error) {
    console.error('Error submitting review:', error);
    alert('Failed to submit review');
  }
}

function formatStatus(status) {
  switch (status) {
    case 'pending': return 'Pending Review';
    case 'approved': return 'Approved';
    case 'changes_requested': return 'Changes Requested';
    default: return status;
  }
}

function formatTimestamp(timestampMs) {
  const mins = Math.floor(timestampMs / 60000);
  const secs = Math.floor((timestampMs % 60000) / 1000);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showLoading() {
  document.getElementById('tags-container').innerHTML = '<div class="loading">Loading tags...</div>';
}

function showError(message) {
  document.getElementById('tags-container').innerHTML = `<div class="error">${message}</div>`;
}

function showSuccessMessage(message) {
  // Simple success notification
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #10B981;
    color: white;
    padding: 12px 24px;
    border-radius: 6px;
    z-index: 1001;
  `;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    document.body.removeChild(notification);
  }, 3000);
}