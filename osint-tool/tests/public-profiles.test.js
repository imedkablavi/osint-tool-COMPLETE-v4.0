const test = require('node:test');
const assert = require('node:assert/strict');
const SocialMediaCollector = require('../src/modules/socialMediaCollector');

const collector = new SocialMediaCollector({});

test('maps an exact GitHub API profile with real public fields', () => {
  const account = collector.mapGitHubProfile('octocat', {
    login: 'octocat',
    id: 1,
    name: 'The Octocat',
    html_url: 'https://github.com/octocat',
    avatar_url: 'https://avatars.example/octocat.png',
    bio: 'GitHub mascot',
    followers: 123,
    following: 7,
    public_repos: 8,
    public_gists: 2,
    created_at: '2008-01-14T04:33:35Z',
    updated_at: '2026-08-01T00:00:00Z',
    type: 'User'
  });

  assert.equal(account.platform, 'GitHub');
  assert.equal(account.username, 'octocat');
  assert.equal(account.displayName, 'The Octocat');
  assert.equal(account.followersCount, 123);
  assert.equal(account.confidenceScore, 95);
  assert.equal(account.additionalData.sourceKind, 'official_public_api');
  assert.equal(account.additionalData.publicRepos, 8);
});

test('rejects a GitHub payload for a different username', () => {
  assert.equal(collector.mapGitHubProfile('alice', { login: 'bob' }), null);
});

test('maps an exact GitLab API profile', () => {
  const account = collector.mapGitLabProfile('alice', {
    id: 44,
    username: 'Alice',
    name: 'Alice Example',
    web_url: 'https://gitlab.com/Alice',
    avatar_url: 'https://gitlab.com/avatar.png',
    state: 'active',
    public_email: 'alice@example.com'
  });

  assert.equal(account.platform, 'GitLab');
  assert.equal(account.username, 'Alice');
  assert.equal(account.additionalData.publicEmail, 'alice@example.com');
  assert.equal(account.additionalData.sourceKind, 'official_public_api');
});

test('Hacker News mapping is case-sensitive and strips HTML from about text', () => {
  const account = collector.mapHackerNewsProfile('jl', {
    id: 'jl',
    about: '<b>Security</b> researcher',
    karma: 2937,
    created: 1173923446,
    submitted: [1, 2, 3]
  });

  assert.equal(account.platform, 'Hacker News');
  assert.equal(account.bio, 'Security researcher');
  assert.equal(account.additionalData.karma, 2937);
  assert.equal(account.additionalData.submittedCount, 3);
  assert.equal(collector.mapHackerNewsProfile('JL', { id: 'jl' }), null);
});
