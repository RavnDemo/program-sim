# One-off: derive corpus/index.yml (the deterministic plan of every scenario) from Juice Shop's
# challenge list plus hand-written outcome calls. Re-running it is safe; it never touches scenario prose.
#   ruby tools/build-index.rb ../bramble/data/static/challenges.yml > corpus/index.yml
require 'yaml'
challenges = YAML.load_file(ARGV[0]).to_h { |c| [c['key'], c] }

BOUNTY = { 'critical' => 3000, 'high' => 1500, 'medium' => 500, 'low' => 150, 'none' => 0 }
# key => [reporter, outcome, final severity, duplicate_of(key) | nil, asset, cwe]
# reporter: nj = nightjar (strong regular), qf = quillfeather (mid), ss = slopstorm (noisy)
CALLS = {
  # --- Injection
  'loginAdminChallenge'            => %w[nj resolved critical - web cwe-89],
  'loginJimChallenge'              => %w[qf duplicate critical loginAdminChallenge web cwe-89],
  'loginBenderChallenge'           => %w[ss duplicate critical loginAdminChallenge web cwe-89],
  'ephemeralAccountantChallenge'   => %w[qf duplicate critical loginAdminChallenge api cwe-89],
  'unionSqlInjectionChallenge'     => %w[nj resolved critical - api cwe-89],
  'dbSchemaChallenge'              => %w[qf duplicate critical unionSqlInjectionChallenge api cwe-89],
  'christmasSpecialChallenge'      => %w[ss duplicate critical unionSqlInjectionChallenge api cwe-89],
  'noSqlReviewsChallenge'          => %w[nj resolved high - api cwe-943],
  'forgedReviewChallenge'          => %w[qf duplicate high noSqlReviewsChallenge api cwe-639],
  'noSqlOrdersChallenge'           => %w[nj resolved high - api cwe-943],
  'noSqlCommandChallenge'          => %w[ss not-applicable none - api cwe-400],
  'sstiChallenge'                  => %w[nj resolved critical - web cwe-1336],
  'chatbotPromptInjectionChallenge'=> %w[qf resolved medium - web cwe-77],
  'chatbotGreedyInjectionChallenge'=> %w[ss duplicate medium chatbotPromptInjectionChallenge web cwe-77],
  'systemPromptExtractionChallenge'=> %w[qf informative none - web cwe-200],
  # --- XSS
  'localXssChallenge'              => %w[qf resolved medium - web cwe-79],
  'xssBonusChallenge'              => %w[ss duplicate medium localXssChallenge web cwe-79],
  'reflectedXssChallenge'          => %w[nj resolved medium - web cwe-79],
  'persistedXssUserChallenge'      => %w[nj resolved high - web cwe-79],
  'restfulXssChallenge'            => %w[nj resolved high - api cwe-79],
  'httpHeaderXssChallenge'         => %w[qf resolved high - api cwe-79],
  'persistedXssFeedbackChallenge'  => %w[qf duplicate high persistedXssUserChallenge api cwe-79],
  'usernameXssChallenge'           => %w[nj resolved high - web cwe-79],
  'videoXssChallenge'              => %w[nj resolved medium - web cwe-79],
  # --- XXE / deserialization
  'xxeFileDisclosureChallenge'     => %w[nj resolved high - api cwe-611],
  'xxeDosChallenge'                => %w[qf duplicate high xxeFileDisclosureChallenge api cwe-776],
  'rceChallenge'                   => %w[nj resolved critical - api cwe-502],
  'rceOccupyChallenge'             => %w[qf duplicate critical rceChallenge api cwe-502],
  'yamlBombChallenge'              => %w[ss not-applicable none - api cwe-776],
  'deprecatedInterfaceChallenge'   => %w[qf resolved low - api cwe-1059],
  # --- Broken access control
  'adminSectionChallenge'          => %w[ss informative none - web cwe-425],
  'basketAccessChallenge'          => %w[qf resolved high - api cwe-639],
  'basketManipulateChallenge'      => %w[nj resolved medium - api cwe-639],
  'changeProductChallenge'         => %w[nj resolved high - api cwe-285],
  'csrfChallenge'                  => %w[qf resolved medium - web cwe-352],
  'forgedFeedbackChallenge'        => %w[qf resolved low - api cwe-639],
  'feedbackChallenge'              => %w[ss duplicate low forgedFeedbackChallenge api cwe-285],
  'passkeyCredentialOverwriteChallenge' => %w[nj resolved critical - api cwe-287],
  'ssrfChallenge'                  => %w[nj resolved high - api cwe-918],
  'aiDebuggingChallenge'           => %w[qf resolved medium - web cwe-284],
  'web3SandboxChallenge'           => %w[ss not-applicable none - web cwe-284],
  # --- Authentication / anti-automation
  'weakPasswordChallenge'          => %w[qf resolved high - web cwe-521],
  'ghostLoginChallenge'            => %w[qf resolved medium - api cwe-89],
  'resetPasswordJimChallenge'      => %w[qf resolved medium - web cwe-640],
  'resetPasswordBenderChallenge'   => %w[ss duplicate medium resetPasswordJimChallenge web cwe-640],
  'resetPasswordBjoernOwaspChallenge' => %w[qf duplicate medium resetPasswordJimChallenge web cwe-640],
  'resetPasswordBjoernChallenge'   => %w[nj duplicate medium resetPasswordJimChallenge web cwe-640],
  'resetPasswordUvoginChallenge'   => %w[ss duplicate medium resetPasswordJimChallenge web cwe-640],
  'resetPasswordMortyChallenge'    => %w[nj resolved medium - api cwe-307],
  'geoStalkingMetaChallenge'       => %w[qf duplicate medium resetPasswordJimChallenge web cwe-640],
  'geoStalkingVisualChallenge'     => %w[ss duplicate medium resetPasswordJimChallenge web cwe-640],
  'oauthUserPasswordChallenge'     => %w[nj resolved critical - web cwe-287],
  'changePasswordBenderChallenge'  => %w[nj resolved high - api cwe-620],
  'passkeySignatureChallenge'      => %w[nj resolved critical - api cwe-347],
  'twoFactorAuthUnsafeSecretStorageChallenge' => %w[nj resolved high - api cwe-312],
  'captchaBypassChallenge'         => %w[qf resolved low - api cwe-804],
  'timingAttackChallenge'          => %w[qf resolved low - api cwe-362],
  'extraLanguageChallenge'         => %w[ss informative none - web cwe-200],
  # --- Crypto
  'weirdCryptoChallenge'           => %w[ss informative none - web cwe-327],
  'forgedCouponChallenge'          => %w[nj resolved high - api cwe-327],
  'easterEggLevelOneChallenge'     => %w[ss informative none - web cwe-538],
  # --- Input validation
  'passwordRepeatChallenge'        => %w[ss informative none - web cwe-20],
  'zeroStarsChallenge'             => %w[ss informative none - api cwe-20],
  'emptyUserRegistration'          => %w[ss informative none - api cwe-20],
  'freeDeluxeChallenge'            => %w[nj resolved high - api cwe-840],
  'negativeOrderChallenge'         => %w[qf resolved high - api cwe-840],
  'registerAdminChallenge'         => %w[nj resolved critical - api cwe-915],
  'uploadSizeChallenge'            => %w[qf resolved low - api cwe-434],
  'uploadTypeChallenge'            => %w[ss duplicate low uploadSizeChallenge api cwe-434],
  'manipulateClockChallenge'       => %w[qf resolved medium - api cwe-840],
  'nullByteChallenge'              => %w[nj resolved high - web cwe-158],
  # --- Sensitive data exposure
  'directoryListingChallenge'      => %w[qf resolved medium - web cwe-548],
  'forgottenBackupChallenge'       => %w[ss duplicate high nullByteChallenge web cwe-530],
  'forgottenDevBackupChallenge'    => %w[qf duplicate high nullByteChallenge web cwe-530],
  'passwordHashLeakChallenge'      => %w[nj resolved high - api cwe-200],
  'exposedCredentialsChallenge'    => %w[qf resolved high - source cwe-798],
  'loginAmyChallenge'              => %w[qf informative none - web cwe-521],
  'loginRapperChallenge'           => %w[ss informative none - web cwe-200],
  'dataExportChallenge'            => %w[nj resolved high - api cwe-200],
  'dlpPastebinDataLeakChallenge'   => %w[ss not-applicable none - - cwe-200],
  'iacLeakedKeyChallenge'          => %w[nj resolved critical - source cwe-321],
  'emailLeakChallenge'             => %w[nj resolved medium - api cwe-200],
  'leakedApiKeyChallenge'          => %w[qf resolved high - source cwe-798],
  'retrieveBlueprintChallenge'     => %w[qf resolved low - web cwe-200],
  'nftUnlockChallenge'             => %w[ss not-applicable none - web cwe-200],
  # --- Observability / misconfiguration
  'exposedMetricsChallenge'        => %w[qf resolved low - web cwe-200],
  'accessLogDisclosureChallenge'   => %w[nj resolved high - web cwe-532],
  'misplacedSignatureFileChallenge'=> %w[ss duplicate high nullByteChallenge web cwe-530],
  'dlpPasswordSprayingChallenge'   => %w[qf not-applicable none - - cwe-200],
  'errorHandlingChallenge'         => %w[ss informative none - api cwe-209],
  'misplacedIacFiles'              => %w[qf resolved medium - web cwe-538],
  'svgInjectionChallenge'          => %w[nj resolved medium - web cwe-79],
  'loginSupportChallenge'          => %w[nj resolved high - source cwe-798],
  'scoreBoardChallenge'            => %w[ss informative none - web cwe-200],
  'securityPolicyChallenge'        => %w[ss informative none - web cwe-200],
  'csafChallenge'                  => %w[ss informative none - web cwe-200],
  # --- Redirects / components
  'redirectCryptoCurrencyChallenge'=> %w[qf resolved low - web cwe-601],
  'redirectChallenge'              => %w[nj resolved medium - web cwe-601],
  'vulnerableDockerImageChallenge' => %w[qf resolved low - source cwe-1104],
  'knownVulnerableComponentChallenge' => %w[qf duplicate low vulnerableDockerImageChallenge source cwe-1104],
  'typosquattingNpmChallenge'      => %w[nj resolved medium - source cwe-1357],
  'typosquattingAngularChallenge'  => %w[nj resolved medium - source cwe-1357],
  'supplyChainAttackChallenge'     => %w[qf resolved medium - source cwe-1395],
  'jwtUnsignedChallenge'           => %w[nj resolved critical - api cwe-347],
  'jwtForgedChallenge'             => %w[qf duplicate critical jwtUnsignedChallenge api cwe-347],
  'lfrChallenge'                   => %w[nj resolved high - api cwe-22],
  'fileWriteChallenge'             => %w[nj resolved critical - api cwe-22],
}
# Synthetic reports with no Juice Shop challenge behind them: the noise every real program gets.
SYNTHETIC = [
  ['N-spam-crypto',      'ss', 'spam',           'none', nil, nil,   nil,       'Unrelated crypto-investment pitch pasted into a report.'],
  ['N-spam-seo',         'ss', 'spam',           'none', nil, nil,   nil,       'SEO/backlink offer, no vulnerability.'],
  ['N-spam-gibberish',   'ss', 'spam',           'none', nil, nil,   nil,       'Keyboard mash / test text.'],
  ['N-beg-headers',      'ss', 'informative',    'none', nil, 'web', 'cwe-693', 'Missing security headers scanner dump (X-Frame-Options, HSTS, CSP), no exploit.'],
  ['N-beg-clickjack',    'ss', 'informative',    'none', nil, 'web', 'cwe-1021','Clickjacking on the marketing landing page, no state-changing action.'],
  ['N-beg-spf',          'ss', 'not-applicable', 'none', nil, nil,   'cwe-290', 'Missing SPF/DMARC on the domain — outside the program scope.'],
  ['N-beg-version',      'ss', 'informative',    'none', nil, 'web', 'cwe-200', 'Server banner / Express version disclosure.'],
  ['N-beg-selfxss',      'ss', 'not-applicable', 'none', nil, 'web', 'cwe-79',  'Self-XSS: payload only fires in the attacker\'s own console.'],
  ['N-beg-logout-csrf',  'ss', 'informative',    'none', nil, 'web', 'cwe-352', 'Logout CSRF.'],
  ['N-beg-ratelimit-nl', 'ss', 'informative',    'none', nil, 'api', 'cwe-770', 'No rate limit on newsletter/feedback endpoint, no impact shown.'],
  ['N-ai-hallucinated',  'ss', 'not-applicable', 'none', nil, 'api', 'cwe-89',  'AI-written SQLi report against an endpoint that does not exist; payloads never reproduce.'],
  ['N-ai-generic-idor',  'ss', 'not-applicable', 'none', nil, 'api', 'cwe-639', 'AI-written IDOR report, generic, references another vendor\'s product names.'],
  ['N-nmi-vague-sqli',   'ss', 'not-applicable', 'none', nil, nil,   nil,       '"I found critical SQLi, pay first and I share PoC" — needs-more-info, no reply, closed.'],
  ['N-nmi-then-valid',   'qf', 'resolved',       'low',  nil, 'api', 'cwe-204', 'User enumeration via different login error; first report vague, needs-more-info, reporter answers with PoC.'],
  ['N-oos-cdn',          'qf', 'not-applicable', 'none', nil, nil,   'cwe-16',  'Misconfiguration on a third-party CDN host Bramble does not own (out of scope).'],
  ['N-oos-staging',      'nj', 'not-applicable', 'none', nil, nil,   'cwe-200', 'Finding on staging host not in scope; reporter asked to retest on production.'],
  ['N-cross-program',    'nj', 'informative',    'none', nil, 'source', 'cwe-1104', 'Upstream Juice Shop dependency issue already public upstream; accepted risk.'],
  ['N-dup-of-own',       'qf', 'duplicate',      'medium','directoryListingChallenge', 'web', 'cwe-548', 'Same reporter re-files their own /ftp listing report with a new title.'],
]
SEV_CLAIM = { 'ss' => 'critical' } # slopstorm always claims critical
rows = []
CALLS.each do |key, (rep, outcome, sev, dup, asset, cwe)|
  c = challenges.fetch(key) { abort "unknown challenge #{key}" }
  rows << { 'challenge' => key, 'name' => c['name'], 'category' => c['category'], 'difficulty' => c['difficulty'],
            'reporter' => { 'nj' => 'nightjar', 'qf' => 'quillfeather', 'ss' => 'slopstorm' }[rep],
            'asset' => (asset == '-' ? nil : asset), 'weakness' => cwe,
            'claimed_severity' => (rep == 'ss' ? 'critical' : (sev == 'none' ? 'low' : sev)),
            'outcome' => outcome, 'severity' => sev, 'bounty' => (outcome == 'resolved' ? BOUNTY[sev] : 0),
            'duplicate_of_challenge' => (dup == '-' ? nil : dup) }
end
SYNTHETIC.each do |slug, rep, outcome, sev, dup, asset, cwe, gist|
  rows << { 'challenge' => nil, 'slug' => slug, 'gist' => gist,
            'reporter' => { 'nj' => 'nightjar', 'qf' => 'quillfeather', 'ss' => 'slopstorm' }[rep],
            'asset' => asset, 'weakness' => cwe, 'claimed_severity' => (rep == 'ss' ? 'critical' : (sev == 'none' ? 'low' : sev)),
            'outcome' => outcome, 'severity' => sev, 'bounty' => (outcome == 'resolved' ? BOUNTY[sev] : 0),
            'duplicate_of_challenge' => dup }
end
# Deterministic interleave, then make every duplicate come after its original.
rng = Random.new(20261110)
rows.shuffle!(random: rng)
placed = []
pending = rows.dup
until pending.empty?
  i = pending.index { |r| r['duplicate_of_challenge'].nil? || placed.any? { |p| p['challenge'] == r['duplicate_of_challenge'] } }
  placed << pending.delete_at(i)
end
placed.each_with_index { |r, n| r['id'] = format('BRM-%03d', n + 1) }
byc = placed.select { |r| r["challenge"] }.to_h { |r| [r["challenge"], r["id"]] }
placed.each { |r| d = r.delete("duplicate_of_challenge"); r["duplicate_of"] = d && byc.fetch(d) }
puts({ 'version' => 1, 'scenarios' => placed.map { |r| r.slice('id','challenge','slug','name','category','difficulty','gist','reporter','asset','weakness','claimed_severity','outcome','severity','bounty','duplicate_of').compact } }.to_yaml)
