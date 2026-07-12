function autoDeleteOldEmails() {
  var conditions = [
    { query: '(category:promotions OR from:rakuten.co.jp OR from:amazon.co.jp) ("重要" OR "ふるさと納税") -has:starred -category:primary older_than:1y', label: '重要・ふるさと納税（1年）ｆ' },
    { query: '("認証コード" OR "確認コード" OR "verification code" OR "認証番号" OR "ワンタイムパスワード" OR "OTP" OR "サインイン" OR "ログインがありました") -has:starred -category:primary older_than:1d', label: 'ログイン・認証（1日）' },
    { query: 'category:promotions -"重要" -"ふるさと納税" -has:starred -category:primary older_than:1m', label: 'プロモーション（1ヶ月）' },
    { query: 'category:purchases -"重要" -"ふるさと納税" -has:starred -category:primary older_than:3m', label: 'ショッピング（3ヶ月）' },
    { query: '(from:rakuten.co.jp OR from:amazon.co.jp) ("注文内容ご確認" OR "発送" OR "注文" OR "お届け") -"重要" -"ふるさと納税" -has:starred -category:primary older_than:1m', label: '楽天/Amazon・注文関連（1ヶ月）' },
    { query: '(from:rakuten.co.jp OR from:amazon.co.jp) -"注文内容ご確認" -"発送" -"注文" -"お届け" -"重要" -"ふるさと納税" -has:starred -category:primary older_than:35d', label: '楽天/Amazon・その他（35日）' },
      { query: 'from:@ad-asahidenso.co.jp older_than:5y -has:starred', label: '旧部署（旭電装）5年以上前' },
  ];

  var excludeDomains = '-from:zenrosai.coop -has:drafts'; 
  var deletedSummary = [];
  var totalDeleted = 0;

  conditions.forEach(function(cond) {
    var threads = GmailApp.search(cond.query + ' ' + excludeDomains, 0, 100);
    if (threads.length > 0) {
      GmailApp.moveThreadsToTrash(threads);
      deletedSummary.push(cond.label + '：' + threads.length + '件');
      totalDeleted += threads.length;
      console.log('「' + cond.label + '」を ' + threads.length + ' 件ゴミ箱に入れました。');
    }
  });

  // 削除結果をスクリプトプロパティに保存
  if (totalDeleted > 0) {
    var props = PropertiesService.getScriptProperties();
    props.setProperty('lastDeletedSummary', deletedSummary.join('\n'));
    props.setProperty('lastDeletedTotal', totalDeleted.toString());
    props.setProperty('lastDeletedDate', Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd'));
  }
}

// ===== Gemini APIキー =====
var GEMINI_API_KEY = 'AIzaSyD7fDgMA5regrWRBVhgGHgfE7Td3gOeIHM';

// ===== 日次ダイジェスト =====
function dailyDigest() {
  var today = new Date();
  var yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  var dateStr = Utilities.formatDate(yesterday, 'Asia/Tokyo', 'yyyy/MM/dd');

  var queries = [
    { q: '(from:rakuten.co.jp OR from:amazon.co.jp OR from:amazon.com OR subject:"注文" OR subject:"発送" OR subject:"お届け") newer_than:1d -from:s.iguchi@gmail.com', label: '注文・発送' },
    { q: '"ふるさと納税" newer_than:1d -from:s.iguchi@gmail.com', label: 'ふるさと納税' },
    { q: '("引き落とし" OR "出金" OR "ご請求" OR "お支払い" OR "クレジット" OR "チャージ" OR "出金予定" OR "お引き落とし") newer_than:1d -from:rakuten-card.co.jp -subject:"カード利用お知らせメール" -from:s.iguchi@gmail.com', label: '出金・請求・チャージ' },
    { q: '("残高" OR "取引" OR "入金" OR "振込" OR "約定" OR "保険料" OR "証券" OR from:smbc.co.jp OR from:rakuten-bank.co.jp OR from:sbi.co.jp OR from:mufg.jp OR from:jp-life.co.jp) newer_than:1d -from:s.iguchi@gmail.com', label: '銀行・証券・保険' },
    { q: '(from:city. OR from:pref. OR from:go.jp OR "マイナンバー" OR "役所" OR "市役所" OR "区役所" OR "税務署" OR "年金" OR "健康保険") newer_than:1d -from:s.iguchi@gmail.com', label: '行政' },
    { q: '(from:apple.com OR from:appleid.apple.com OR subject:"App Store" OR subject:"iCloud") newer_than:1d -from:s.iguchi@gmail.com', label: 'Apple' },
    { q: '(from:playstation.com OR from:sony.com OR from:nintendo.com OR from:falcom.co.jp OR subject:"PlayStation" OR subject:"任天堂" OR subject:"ニンテンドー" OR subject:"ファルコム") newer_than:1d -from:s.iguchi@gmail.com', label: 'ゲーム' },
    { q: 'from:schoo.jp newer_than:1d -from:s.iguchi@gmail.com', label: 'Schoo' },
    { q: '("不正" OR "不審" OR "ログインがありました" OR "身に覚えのない" OR "セキュリティ") newer_than:1d -from:s.iguchi@gmail.com', label: '不審ログイン・セキュリティ' },
    { q: 'category:promotions ("セール" OR "SALE" OR "タイムセール" OR "クーポン") newer_than:1d -from:s.iguchi@gmail.com', label: 'セール・クーポン' },
    { q: 'is:important newer_than:1d -has:starred -(from:rakuten.co.jp OR from:amazon.co.jp OR from:apple.com OR from:playstation.com OR from:nintendo.com OR from:falcom.co.jp OR from:schoo.jp) -from:s.iguchi@gmail.com', label: 'その他重要メール' },
    { q: 'from:send03.anpiap.alsok.co.jp newer_than:1d', label: 'ALSOK安否確認' }
   ];
  var sections = [];
  // 重要メールをタスクに追加
  addImportantMailsToTask();
  var totalDeleted = 0; // 削除件数は自動削除関数と連携できないためスキップ

  queries.forEach(function(item) {
    var threads = GmailApp.search(item.q, 0, 20);
    if (threads.length === 0) return;

    var entries = [];
    threads.forEach(function(thread) {
      var msg = thread.getMessages()[thread.getMessageCount() - 1];
      var subject = msg.getSubject();
      var from = msg.getFrom();
      var body = msg.getPlainBody().substring(0, 500);
      entries.push('件名: ' + subject + '\n差出人: ' + from + '\n本文: ' + body);
    });

    sections.push('【' + item.label + '】' + threads.length + '件\n' + entries.join('\n---\n'));
  });

// 期限メールセクションを追加
  var deadlineSection = getDeadlineSection();

// スケジュールセクションを追加
  var scheduleSection = getScheduleSection();

// 楽天カード累積額（Gemini要約に含めず直接表示）
  var rakutenCardDetails = getRakutenMastercardDetails();
  var rakutenCardSection = getRakutenCardMonthlyTotal() 
  + (rakutenCardDetails ? '\n\n' + rakutenCardDetails : '');

// ゴミ箱メールのサマリー追加（Gemini要約に含めず直接追記）
  var trashSection = getTrashSummary();

// Grok AIまとめ追加
  var grokSection = getGrokSection();

  if (sections.length === 0) {
    console.log('対象メールなし。ダイジェスト送信スキップ。');
    return;
  }

  var prompt = 
    '以下は' + dateStr + 'に届いたメールの一覧です。\n' +
    'カテゴリごとに日本語で要約してください。\n' +
    '各カテゴリは箇条書きで、件名・金額・期日など重要な情報を含めて簡潔にまとめてください。\n' +
    '特に注意が必要なもの（出金・期限・不審ログイン）は冒頭に【要注意】として目立つようにまとめてください。\n\n' +
    '※すでに期限が過ぎた内容（昨日以前が期限のもの）は要約に含めないでください。\n\n' +
    sections.join('\n\n');

  var summary = callGemini(prompt);
  
  // Gemini失敗時は件名一覧にフォールバック
  if (!summary) {
    summary = '【Gemini要約失敗のため件名一覧をお届けします】\n\n';
    queries.forEach(function(item) {
      var threads = GmailApp.search(item.q, 0, 20);
      if (threads.length === 0) return;
      summary += '【' + item.label + '】\n';
      threads.forEach(function(thread) {
        summary += '・' + thread.getMessages()[thread.getMessageCount() - 1].getSubject() + '\n';
      });
      summary += '\n';
    });
  }

  var recipient = Session.getActiveUser().getEmail();
  var emailBody = 'Gmail日次ダイジェスト（' + dateStr + '）\n\n' 
    + (scheduleSection ? scheduleSection + '\n\n' : '')
    + (deadlineSection ? deadlineSection + '\n\n' : '')
    + summary 
    + (rakutenCardSection ? '\n\n' + rakutenCardSection : '')
    + (trashSection ? '\n\n' + trashSection : '') 
    + (grokSection ? '\n\n' + grokSection : '')
    + '\n\n---\n※このメールはGASが自動送信しました。';
GmailApp.sendEmail(recipient, 'Gmail日次ダイジェスト ' + dateStr, emailBody);
  console.log('ダイジェスト送信完了');
}

// ===== Grok AIまとめ =====
function getGrokSection() {
  var threads = GmailApp.search('from:noreply@x.ai newer_than:1d', 0, 5);
  if (threads.length === 0) return null;

  var entries = [];
  threads.forEach(function(thread) {
    var msg = thread.getMessages()[0];
    var body = msg.getPlainBody();
    entries.push(body);
  });

  return '【Grok AIまとめ】\n' + entries.join('\n\n---\n\n');
}

// ===== Gemini API呼び出し =====
function callGemini(prompt) {
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_API_KEY;
  var payload = {
    contents: [{ parts: [{ text: prompt }] }]
  };
  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  for (var i = 0; i < 3; i++) {
    var response = UrlFetchApp.fetch(url, options);
    var json = JSON.parse(response.getContentText());
    try {
      var text = json.candidates[0].content.parts[0].text;
      if (text) return text;
    } catch(e) {
      var code = json.error ? json.error.code : 0;
      if ((code === 503 || code === 429) && i < 2) {
        console.log('Gemini混雑中。' + (i + 1) + '回目リトライ...');
        Utilities.sleep(60000);
      } else {
        return null;
      }
    }
  }
  return null;
}

// ===== 期限メール管理 =====
function checkDeadlineMails() {
  var scriptProps = PropertiesService.getScriptProperties();
  var deadlinesJson = scriptProps.getProperty('deadlines');
  var deadlines = deadlinesJson ? JSON.parse(deadlinesJson) : {};
  
  var query = '("支払期限" OR "お支払い期限" OR "振込期限" OR "引き落とし日" OR "口座振替日" OR "申込締切" OR "お申し込み期限" OR "登録期限" OR "契約更新" OR "更新期限" OR "自動更新" OR "ポイント失効" OR "ポイント有効期限" OR "ポイント期限") newer_than:30d -has:starred -subject:"Gmail日次ダイジェスト" -subject:"ご注文ありがとう" -subject:"お買い上げありがとう" -subject:"注文明細" -subject:"ご購入ありがとう" -from:s.iguchi@gmail.com';
  var threads = GmailApp.search(query, 0, 20);
  
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  
  threads.forEach(function(thread) {
    var msg = thread.getMessages()[0];
    var subject = msg.getSubject();
    var body = msg.getPlainBody().substring(0, 1000);
    var threadId = thread.getId();
    
    if (deadlines[threadId]) return;
    
    var datePatterns = [
      /(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})/,
      /(\d{1,2})[月\/](\d{1,2})日?/
    ];
    
    var deadline = null;
    for (var i = 0; i < datePatterns.length; i++) {
      var match = body.match(datePatterns[i]);
      if (match) {
        try {
          if (match.length === 4) {
            deadline = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
          } else {
            var year = today.getFullYear();
            deadline = new Date(year, parseInt(match[1]) - 1, parseInt(match[2]));
            if (deadline < today) deadline.setFullYear(year + 1);
          }
          deadline.setHours(0, 0, 0, 0);
          if (deadline >= today && deadline <= new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000)) break;
          else deadline = null;
        } catch(e) { deadline = null; }
      }
    }
    
    if (!deadline) return;
    
    deadlines[threadId] = {
      subject: subject,
      deadline: deadline.getTime(),
      body: body.substring(0, 200)
    };
    
    try {
      var taskLists = Tasks.Tasklists.list();
      var taskListId = taskLists.items[0].id;
      Tasks.Tasks.insert({
        title: '【期限】' + subject,
        notes: body.substring(0, 500),
        due: deadline.toISOString()
      }, taskListId);
      console.log('ToDo追加: ' + subject);
    } catch(e) {
      console.log('ToDo追加失敗: ' + e.toString());
    }
  });
  
  Object.keys(deadlines).forEach(function(id) {
    if (deadlines[id].deadline < today.getTime()) {
      delete deadlines[id];
    }
  });
  
  scriptProps.setProperty('deadlines', JSON.stringify(deadlines));
  return deadlines;
}

function getDeadlineSection() {
  var deadlines = checkDeadlineMails();
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (Object.keys(deadlines).length === 0) return null;
  
  var entries = [];
  Object.values(deadlines).forEach(function(d) {
    var deadlineDate = new Date(d.deadline);
    var diffDays = Math.round((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    // ここを追加：30日以上先はスキップ
    if (diffDays > 30) return;
    
    var urgency = diffDays === 0 ? '【今日が期限！】' : '【残り' + diffDays + '日】';
    entries.push(urgency + ' ' + d.subject + '\n期限：' + Utilities.formatDate(deadlineDate, 'Asia/Tokyo', 'yyyy/MM/dd'));
  });
  
  if (entries.length === 0) return null;
  
  return '【期限が近いメール】\n' + entries.join('\n---\n');
}

// ===== ゴミ箱サマリー =====
function getTrashSummary() {
  var props = PropertiesService.getScriptProperties();
  var summary = props.getProperty('lastDeletedSummary');
  var total = props.getProperty('lastDeletedTotal');
  var date = props.getProperty('lastDeletedDate');
  var today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd');

  if (!summary || date !== today) return null;

  // ログイン・認証を除外
  var lines = summary.split('\n').filter(function(line) {
    return line.indexOf('ログイン・認証') === -1;
  });

  if (lines.length === 0) return null;

  // その他メールの件名を取得
  var otherThreads = GmailApp.search(
    'in:trash -from:rakuten.co.jp -from:amazon.co.jp -category:promotions -category:purchases -("認証コード" OR "確認コード" OR "ワンタイムパスワード") -subject:"Gmail日次ダイジェスト" newer_than:2d',
    0, 20
  );

  var result = '【本日ゴミ箱に移動したメール】\n' + lines.join('\n');

  if (otherThreads.length > 0) {
    var subjects = otherThreads.map(function(t) {
      return '・' + t.getMessages()[0].getSubject();
    });
    result += '\nその他：' + otherThreads.length + '件\n' + subjects.join('\n');
  }

  return result;
}

function testTrash() {
  var today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd');
  var threads = GmailApp.search('in:trash after:' + today, 0, 10);
  console.log('ゴミ箱の今日のメール：' + threads.length + '件');
  threads.forEach(function(t) {
    console.log(t.getMessages()[0].getSubject());
  });
}

function checkProps() {
  var props = PropertiesService.getScriptProperties();
  console.log('date: ' + props.getProperty('lastDeletedDate'));
  console.log('total: ' + props.getProperty('lastDeletedTotal'));
  console.log('summary: ' + props.getProperty('lastDeletedSummary'));
}

function checkDeadlineProps() {
  var props = PropertiesService.getScriptProperties();
  var deadlinesJson = props.getProperty('deadlines');
  var deadlines = deadlinesJson ? JSON.parse(deadlinesJson) : {};
  
  Object.values(deadlines).forEach(function(d) {
    var deadlineDate = new Date(d.deadline);
    console.log(d.subject + ' → 期限：' + Utilities.formatDate(deadlineDate, 'Asia/Tokyo', 'yyyy/MM/dd'));
  });
  
  console.log('合計：' + Object.keys(deadlines).length + '件');
}

function testTrashSummary() {
  var props = PropertiesService.getScriptProperties();
  var summary = props.getProperty('lastDeletedSummary');
  var date = props.getProperty('lastDeletedDate');
  var today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd');
  
  console.log('date一致：' + (date === today));
  
  var lines = summary.split('\n').filter(function(line) {
    return line.indexOf('ログイン・認証') === -1;
  });
  
  console.log('lines件数：' + lines.length);
  console.log('lines内容：' + lines.join(' / '));
}

function testDeadlineSearch() {
  var query = '("支払期限" OR "お支払い期限" OR "振込期限" OR "引き落とし日" OR "口座振替日" OR "申込締切" OR "お申し込み期限" OR "登録期限" OR "契約更新" OR "更新期限" OR "自動更新" OR "ポイント失効" OR "ポイント有効期限" OR "ポイント期限") newer_than:30d -has:starred';
  var threads = GmailApp.search(query, 0, 20);
  console.log('検索結果：' + threads.length + '件');
  threads.forEach(function(t) {
    console.log(t.getMessages()[0].getSubject());
  });
}

// ===== 楽天カード引き落とし予定 =====
function getRakutenCardPayment() {
  var threads = GmailApp.search(
    'from:rakuten-card.co.jp subject:"お支払い金額のご案内" newer_than:10d',
    0, 5
  );
  
  if (threads.length === 0) return null;
  
  var entries = [];
  threads.forEach(function(thread) {
    var msg = thread.getMessages()[0];
    var body = msg.getPlainBody();
    
    // 金額・カード・口座・引き落とし日を抽出
    var amountMatch = body.match(/お支払い金額\s*[\r\n]+\s*([\d,]+)円/);
    var cardMatch = body.match(/ご利用カード\s*[\r\n]+\s*(.+)/);
    var dateMatch = body.match(/お支払い日\s*[\r\n]+\s*(\d{4}\/\d{2}\/\d{2})/);
    var bankMatch = body.match(/お支払い口座[\s\S]*?(楽天銀行\S+|静岡銀行\S+)/);
    
    if (amountMatch && cardMatch) {
      var amount = amountMatch[1];
      var card = cardMatch[1].trim();
      var date = dateMatch ? dateMatch[1] : '不明';
      var bank = bankMatch ? bankMatch[1] : '不明';
      
      entries.push('・' + card + '：' + amount + '円（' + date + ' / ' + bank + '）');
    }
  });
  
  if (entries.length === 0) return null;
  
  return '【楽天カード引き落とし予定】\n' + entries.join('\n');
}

function testRakutenCard() {
  var result = getRakutenCardPayment();
  console.log(result ? result : 'メールなし（今月分未着）');
}

// ===== 楽天カード引き落とし事前アラート =====
function rakutenCardAlert() {
  var threads = GmailApp.search(
    'from:rakuten-card.co.jp subject:"お支払い金額のご案内" newer_than:10d',
    0, 5
  );
  
  if (threads.length === 0) return;
  
  var entries = [];
  var today = new Date();
  
  threads.forEach(function(thread) {
    var msg = thread.getMessages()[0];
    var body = msg.getPlainBody();
    
    var amountMatch = body.match(/お支払い金額\s*[\r\n]+\s*([\d,]+)円/);
    var cardMatch = body.match(/ご利用カード\s*[\r\n]+\s*(.+)/);
    var dateMatch = body.match(/お支払い日\s*[\r\n]+\s*(\d{4}\/\d{2}\/\d{2})/);
    var bankMatch = body.match(/お支払い口座[\s\S]*?(楽天銀行\S+|静岡銀行\S+)/);
    
    if (!amountMatch || !dateMatch) return;
    
    var payDate = new Date(dateMatch[1].replace(/\//g, '-'));
    var diffDays = Math.round((payDate - today) / (1000 * 60 * 60 * 24));
    
    // 引き落とし3日前〜前日だけ通知
    if (diffDays >= 1 && diffDays <= 3) {
      entries.push(
        '・' + cardMatch[1].trim() + '：' + amountMatch[1] + '円\n' +
        '　引き落とし日：' + dateMatch[1] + '（残り' + diffDays + '日）\n' +
        '　口座：' + (bankMatch ? bankMatch[1] : '不明')
      );
    }
  });
  
  if (entries.length === 0) return;
  
  var body = '【⚠️ 楽天カード引き落とし直前アラート】\n\n' + 
             entries.join('\n') + 
             '\n\n残高をご確認ください。';
  
  GmailApp.sendEmail(
    Session.getActiveUser().getEmail(),
    '⚠️ 楽天カード引き落とし直前アラート',
    body
  );
  console.log('アラート送信完了');
}

// ===== Mastercardサブスク一覧 =====
function getMastercardSubscriptions() {
  var today = new Date();
  var todayDay = today.getDate();
  
  var subscriptions = [
    { name: 'ボイシー', amount: 1000, day: 2 },
    { name: 'APPLE COM BILL', amount: 450, day: 2 },
    { name: 'リンクスメイト', amount: 165, day: 10 },
    { name: 'CLAUDE.AI', amount: 3309, day: 24 },
    { name: 'GOOGLE PLAY', amount: 780, day: 25 },
    { name: 'PAYPAL/OURARING', amount: 1164, day: 27 }
  ];
  
  var remaining = [];
  var remainingTotal = 0;
  
  subscriptions.forEach(function(sub) {
    if (sub.day > todayDay) {
      remaining.push(sub);
      remainingTotal += sub.amount;
    }
  });
  
  return { list: subscriptions, remaining: remaining, remainingTotal: remainingTotal };
}

// ===== 楽天カード今月累積使用額 =====
function getRakutenCardMonthlyTotal() {
  var today = new Date();
  var thisMonth = today.getFullYear() + '/' + ('0' + (today.getMonth() + 1)).slice(-2);
  var nextMonth = today.getMonth() + 2 > 12 
    ? (today.getFullYear() + 1) + '/01'
    : today.getFullYear() + '/' + ('0' + (today.getMonth() + 2)).slice(-2);

  var threads = GmailApp.search(
    'from:rakuten-card.co.jp "カード利用お知らせメール(確定版)" newer_than:90d in:anywhere',
    0, 500
  );

  var totals = {
    thisMonth: { Mastercard: 0, Visa: 0 },
    nextMonth: { Mastercard: 0, Visa: 0 }
  };

  var MASTERCARD_BUDGET = 12000;

  threads.forEach(function(thread) {
    var messages = thread.getMessages();
    messages.forEach(function(msg) {
      var body = msg.getPlainBody();
      var cardType = body.indexOf('楽天カード（Mastercard）') !== -1 ? 'Mastercard' : 'Visa';

      var bodyLines = body.split('\n');
      var currentAmount = null;

      bodyLines.forEach(function(line) {
        line = line.trim();

        var amountMatch = line.match(/■利用金額[：:]\s*([\d,]+)\s*円/);
        if (amountMatch) {
          currentAmount = parseInt(amountMatch[1].replace(/,/g, ''));
          return;
        }

        var payMonthMatch = line.match(/■支払月[：:]\s*(\d{4}\/\d{2})/);
        if (payMonthMatch && currentAmount !== null) {
          var payMonth = payMonthMatch[1];
          if (payMonth === thisMonth) {
            totals.thisMonth[cardType] += currentAmount;
          } else if (payMonth === nextMonth) {
            totals.nextMonth[cardType] += currentAmount;
          }
          currentAmount = null;
        }
      });
    });
  });

  var lines = [];
  if (totals.thisMonth.Mastercard > 0 || totals.thisMonth.Visa > 0) {
    lines.push('【' + thisMonth + '引き落とし分】');
    if (totals.thisMonth.Mastercard > 0) {
      lines.push('・Mastercard（楽天銀行）：' + totals.thisMonth.Mastercard.toLocaleString() + '円');
    }
    if (totals.thisMonth.Visa > 0) lines.push('・Visa（静岡銀行）：' + totals.thisMonth.Visa.toLocaleString() + '円');
  }
  if (totals.nextMonth.Mastercard > 0 || totals.nextMonth.Visa > 0) {
    lines.push('【' + nextMonth + '引き落とし分】');
    if (totals.nextMonth.Mastercard > 0) {
      lines.push('・Mastercard（楽天銀行）：' + totals.nextMonth.Mastercard.toLocaleString() + '円');
    }
    if (totals.nextMonth.Visa > 0) lines.push('・Visa（静岡銀行）：' + totals.nextMonth.Visa.toLocaleString() + '円');
  }

  if (lines.length === 0) return null;

  var subs = getMastercardSubscriptions();
  var subsLines = ['\n【Mastercardサブスク】'];
  subs.list.forEach(function(s) {
    var mark = s.day <= new Date().getDate() ? '済' : '未';
    subsLines.push('・' + s.name + '　' + s.amount.toLocaleString() + '円　' + s.day + '日（' + mark + '）');
  });

  if (subs.remainingTotal > 0) {
    subsLines.push('サブスク残り予定：' + subs.remainingTotal.toLocaleString() + '円');
  }

  // デビット合計取得
  var debit = getRakutenBankDebitTotal();
  var debitLines = ['\n【楽天銀行デビットカード利用（今月）】'];
  if (debit.items.length > 0) {
    debit.items.forEach(function(item) {
      debitLines.push('・' + item.date + '  ' + item.amount.toLocaleString() + '円');
    });
  } else {
    debitLines.push('・利用なし');
  }
  debitLines.push('合計  ' + debit.total.toLocaleString() + '円');

  // 総合予算計算
  var TOTAL_BUDGET = 14000;
  var allSubsTotal = subs.list.reduce(function(sum, s) { return sum + s.amount; }, 0);
　var allSubsTotal = subs.list.reduce(function(sum, s) { return sum + s.amount; }, 0);
  var totalUsed = totals.thisMonth.Mastercard + subs.remainingTotal + debit.total;
  var totalSpendable = TOTAL_BUDGET - totalUsed;
  var totalSpendableStr = totalSpendable >= 0 
    ? '\nあと' + totalSpendable.toLocaleString() + '円使えます（予算' + TOTAL_BUDGET.toLocaleString() + '円）'
    : '\nすでに' + Math.abs(totalSpendable).toLocaleString() + '円超過予定！（予算' + TOTAL_BUDGET.toLocaleString() + '円）';

  return '【楽天カード引き落とし累積額】\n' + lines.join('\n') + subsLines.join('\n') + debitLines.join('\n') + totalSpendableStr;
}

function debugRakutenCard() {
  var threads = GmailApp.search(
    'from:rakuten-card.co.jp "カード利用お知らせメール(確定版)" newer_than:90d in:anywhere',
    0, 500
  );
  
  console.log('取得件数: ' + threads.length);
  
  threads.forEach(function(thread) {
    var msg = thread.getMessages()[0];
    var body = msg.getPlainBody().substring(0, 300);
    console.log('---');
    console.log('件名: ' + msg.getSubject());
    console.log('本文冒頭: ' + body);
  });
}

function testMonthlyTotal() {
  var result = getRakutenCardMonthlyTotal();
  console.log(result ? result : 'データなし');
}

function debugMonthlyDetail() {
  var today = new Date();
  var thisMonth = today.getFullYear() + '/' + ('0' + (today.getMonth() + 1)).slice(-2);
  var nextMonth = today.getMonth() + 2 > 12 
    ? (today.getFullYear() + 1) + '/01'
    : today.getFullYear() + '/' + ('0' + (today.getMonth() + 2)).slice(-2);

  var threads = GmailApp.search(
    'from:rakuten-card.co.jp "カード利用お知らせメール(確定版)" newer_than:35d',
    0, 500  // 50→500に変更
  );

  console.log('取得メール数: ' + threads.length);

  threads.forEach(function(thread) {
    var msg = thread.getMessages()[0];
    var body = msg.getPlainBody();
    var subject = msg.getSubject();
    var cardType = body.indexOf('楽天カード（Mastercard）') !== -1 ? 'Mastercard' : 'Visa';

    // 支払月ごとに金額を個別に抽出
    var lines = body.split('\n');
    var currentPayMonth = null;
    var itemDetails = [];

    lines.forEach(function(line) {
      var payMonthMatch = line.match(/支払月[：:]\s*(\d{4}\/\d{2})/);
      if (payMonthMatch) currentPayMonth = payMonthMatch[1];

      var amountMatch = line.match(/■利用金額[：:]\s*([\d,]+)\s*円/);
      if (amountMatch && currentPayMonth) {
        itemDetails.push('  支払月:' + currentPayMonth + ' 金額:' + amountMatch[1] + '円');
      }
    });

    if (itemDetails.length > 0) {
      console.log('[' + cardType + '] ' + msg.getSubject().substring(0, 30));
      itemDetails.forEach(function(d) { console.log(d); });
    }
  });
}

function debugCount() {
  var threads = GmailApp.search(
    'from:rakuten-card.co.jp "カード利用お知らせメール(確定版)" newer_than:60d in:anywhere',
    0, 500
  );
  console.log('取得スレッド数: ' + threads.length);
  
  var msgCount = 0;
  threads.forEach(function(thread) {
    msgCount += thread.getMessageCount();
    console.log(thread.getMessages()[0].getSubject() + ' / ' + thread.getMessages()[0].getDate());
  });
  console.log('総メッセージ数: ' + msgCount);
}

function debugAllMessages() {
  var threads = GmailApp.search(
    'from:rakuten-card.co.jp "カード利用お知らせメール(確定版)" newer_than:60d in:anywhere',
    0, 500
  );

  threads.forEach(function(thread) {
    var messages = thread.getMessages();
    messages.forEach(function(msg) {
      var body = msg.getPlainBody();
      // 支払月2026/04の金額だけ表示
      var lines = body.split('\n');
      var currentAmount = null;
      lines.forEach(function(line) {
        line = line.trim();
        var amountMatch = line.match(/■利用金額[：:]\s*([\d,]+)\s*円/);
        if (amountMatch) currentAmount = amountMatch[1];
        var payMonthMatch = line.match(/■支払月[：:]\s*(2026\/04)/);
        if (payMonthMatch && currentAmount) {
          console.log(msg.getDate() + ' / ' + currentAmount + '円 / 2026/04');
          currentAmount = null;
        }
      });
    });
  });
}

function resetDeadlines() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty('deadlines');
  console.log('deadlinesをリセットしました');
}

// ===== 今日・明日のスケジュール =====
function getScheduleSection() {
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  
  var dayAfterTomorrow = new Date(today);
  dayAfterTomorrow.setDate(today.getDate() + 2);
  
  var lines = [];
  
  // カレンダーのイベント取得
  try {
    var calendars = CalendarApp.getAllCalendars();
    var events = [];
    calendars.forEach(function(cal) {
      var calEvents = cal.getEvents(today, dayAfterTomorrow);
      calEvents.forEach(function(ev) {
        events.push({
          title: ev.getTitle(),
          start: ev.getStartTime(),
          isAllDay: ev.isAllDayEvent()
        });
      });
    });
    
    // 今日と明日に分ける
    var todayStr = Utilities.formatDate(today, 'Asia/Tokyo', 'MM/dd');
    var tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    var tomorrowStr = Utilities.formatDate(tomorrow, 'Asia/Tokyo', 'MM/dd');
    
    var todayEvents = [];
    var tomorrowEvents = [];
    
    events.forEach(function(ev) {
      var evDate = Utilities.formatDate(ev.start, 'Asia/Tokyo', 'MM/dd');
      var timeStr = ev.isAllDay ? '終日' : Utilities.formatDate(ev.start, 'Asia/Tokyo', 'HH:mm');
      var entry = timeStr + ' ' + ev.title;
      if (evDate === todayStr) todayEvents.push(entry);
      else if (evDate === tomorrowStr) tomorrowEvents.push(entry);
    });
    
    if (todayEvents.length > 0) {
      lines.push('今日（' + todayStr + '）\n' + todayEvents.map(function(e){ return '・' + e; }).join('\n'));
    }
    if (tomorrowEvents.length > 0) {
      lines.push('明日（' + tomorrowStr + '）\n' + tomorrowEvents.map(function(e){ return '・' + e; }).join('\n'));
    }
  } catch(e) {
    console.log('カレンダー取得失敗: ' + e.toString());
  }
  
  // Tasksのタスク取得（期限が今日・明日のもの）
  try {
    var tomorrow2 = new Date(today);
    tomorrow2.setDate(today.getDate() + 1);
    tomorrow2.setHours(23, 59, 59, 0);
    
    var taskLists = Tasks.Tasklists.list();
    var todayTasks = [];
    var tomorrowTasks = [];
    
    if (taskLists.items) {
      taskLists.items.forEach(function(list) {
        var tasks = Tasks.Tasks.list(list.id, { showCompleted: false });
        if (tasks.items) {
          tasks.items.forEach(function(task) {
            if (!task.due) return;
            var dueDate = new Date(task.due);
            var dueDateStr = Utilities.formatDate(dueDate, 'Asia/Tokyo', 'MM/dd');
            var todayStr2 = Utilities.formatDate(today, 'Asia/Tokyo', 'MM/dd');
            var tomorrow3 = new Date(today);
            tomorrow3.setDate(today.getDate() + 1);
            var tomorrowStr2 = Utilities.formatDate(tomorrow3, 'Asia/Tokyo', 'MM/dd');
            
            var oneWeekLater = new Date(today);
            oneWeekLater.setDate(today.getDate() + 7);
            if (dueDate <= today) todayTasks.push('・' + task.title);
            else if (dueDate <= oneWeekLater) tomorrowTasks.push('・' + task.title + '（' + dueDateStr + '）');
          });
        }
      });
    }
    
    if (todayTasks.length > 0 || tomorrowTasks.length > 0) {
      var taskLines = [];
      if (todayTasks.length > 0) taskLines.push('今日：\n' + todayTasks.join('\n'));
      if (tomorrowTasks.length > 0) taskLines.push('今後7日：\n' + tomorrowTasks.join('\n'));
      lines.push('[Tasks]\n' + taskLines.join('\n'));
    }
  } catch(e) {
    console.log('Tasks取得失敗: ' + e.toString());
  }
  
  if (lines.length === 0) return null;
  
  return '【今日・明日のスケジュール】\n' + lines.join('\n---\n');
}

function checkRakutenMailDate() {
  var threads = GmailApp.search('subject:"楽天カード カードご請求金額のご案内" newer_than:30d', 0, 1);
  if (threads.length === 0) { console.log('メールなし'); return; }
  var body = threads[0].getMessages()[0].getPlainBody();
  // 日付パターンを全部抽出
  var matches = body.match(/\d{4}[\/\-年]\d{1,2}[\/\-月]\d{1,2}/g);
  console.log(JSON.stringify(matches));
}

function cleanDeadlines() {
  var props = PropertiesService.getScriptProperties();
  var deadlines = JSON.parse(props.getProperty('deadlines') || '{}');
  var today = new Date();
  var oneYearLater = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000);
  
  Object.keys(deadlines).forEach(function(id) {
    var d = new Date(deadlines[id].deadline);
    if (d > oneYearLater) {
      console.log('削除: ' + deadlines[id].subject + ' → ' + d);
      delete deadlines[id];
    }
  });
  
  props.setProperty('deadlines', JSON.stringify(deadlines));
  console.log('完了');
}

// ===== 重要メールをタスクに追加 =====
function addImportantMailsToTask() {
  var scriptProps = PropertiesService.getScriptProperties();
  var addedJson = scriptProps.getProperty('addedToTask');
  var added = addedJson ? JSON.parse(addedJson) : {};

  var threads = GmailApp.search('is:important -has:starred newer_than:2d', 0, 20);
  
  threads.forEach(function(thread) {
    var threadId = thread.getId();
    if (added[threadId]) return;
    
    var msg = thread.getMessages()[thread.getMessageCount() - 1];
    var subject = msg.getSubject();
    var from = msg.getFrom();
    
    try {
      var taskLists = Tasks.Tasklists.list();
      var taskListId = taskLists.items[0].id;
      Tasks.Tasks.insert({
        title: '【返信確認】' + subject,
        notes: '差出人: ' + from,
      }, taskListId);
      console.log('タスク追加: ' + subject);
      added[threadId] = true;
    } catch(e) {
      console.log('タスク追加失敗: ' + e.toString());
    }
  });

  scriptProps.setProperty('addedToTask', JSON.stringify(added));
}

function testImportantMails() {
  var threads = GmailApp.search('is:important -has:starred newer_than:7d', 0, 20);
  console.log('件数：' + threads.length + '件');
  threads.forEach(function(t) {
    console.log(t.getMessages()[0].getSubject());
  });
}

function testQueries() {
  var queries = [
    { q: '("引き落とし" OR "出金" OR "ご請求" OR "お支払い" OR "クレジット" OR "チャージ" OR "出金予定" OR "お引き落とし") newer_than:1d', label: '出金・請求' },
    { q: '(from:playstation.com OR from:sony.com OR from:nintendo.com OR from:falcom.co.jp OR subject:"PlayStation" OR subject:"任天堂" OR subject:"ニンテンドー" OR subject:"ファルコム") newer_than:1d', label: 'ゲーム' },
  ];
  
  queries.forEach(function(item) {
    var threads = GmailApp.search(item.q, 0, 20);
    console.log(item.label + '：' + threads.length + '件');
  });
}

function testSections() {
  console.log('deadlineSection開始');
  var deadlineSection = getDeadlineSection();
  console.log('deadlineSection完了');
  
  console.log('scheduleSection開始');
  var scheduleSection = getScheduleSection();
  console.log('scheduleSection完了');
  
  console.log('rakutenCardSection開始');
  var rakutenCardDetails = getRakutenMastercardDetails();
  var rakutenCardSection = getRakutenCardMonthlyTotal() 
  + (rakutenCardDetails ? '\n\n' + rakutenCardDetails : '');
  console.log('rakutenCardSection完了');
  
  console.log('trashSection開始');
  var trashSection = getTrashSummary();
  console.log('trashSection完了');

  console.log('grokSection開始');
  var grokSection = getGrokSection();
  console.log('grokSection完了');
}

function testSectionsCount() {
  var queries = [
    { q: '("引き落とし" OR "出金" OR "ご請求" OR "お支払い" OR "クレジット" OR "チャージ" OR "出金予定" OR "お引き落とし") newer_than:1d -from:rakuten-card.co.jp -subject:"カード利用お知らせメール" -from:s.iguchi@gmail.com', label: '出金・請求' },
    { q: '(from:playstation.com OR from:sony.com OR from:nintendo.com OR from:falcom.co.jp OR subject:"PlayStation" OR subject:"任天堂" OR subject:"ニンテンドー" OR subject:"ファルコム") newer_than:1d -from:s.iguchi@gmail.com', label: 'ゲーム' },
  ];
  
  queries.forEach(function(item) {
    var threads = GmailApp.search(item.q, 0, 20);
    console.log(item.label + '：' + threads.length + '件');
  });
}

function getRakutenMastercardDetails() {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const targetMonth = Utilities.formatDate(nextMonth, 'Asia/Tokyo', 'yyyy/MM');

  // サブスク除外リスト（getMastercardSubscriptionsと同じキーワード）
  const SUBSCRIPTIONS = ['ﾎﾞｲｼ-', 'ﾘﾝｸｽﾒｲﾄ', 'CLAUDE.AI', 'GOOGLE PLAY', 'PAYPAL', 'APPLE'];

  const threads = GmailApp.search(
  'from:rakuten-card.co.jp "カード利用お知らせメール(確定版)" newer_than:60d in:anywhere',0, 500);
  const results = [];

  threads.forEach(thread => {
    thread.getMessages().forEach(msg => {
      const body = msg.getPlainBody();
      if (!body.includes('Mastercard')) return;

      // 1件分のブロックを分割して処理
      const blocks = body.split('■利用日:').slice(1);
      blocks.forEach(block => {
        const dateMatch = block.match(/^\s*(\d{4}\/\d{2}\/\d{2})/);
        const shopMatch = block.match(/■利用先:\s*(.+)/);
        const amountMatch = block.match(/■利用金額:\s*([\d,]+)\s*円/);
        const monthMatch = block.match(/■支払月:\s*(\d{4}\/\d{2})/);

        if (!dateMatch || !shopMatch || !amountMatch || !monthMatch) return;
        if (monthMatch[1] !== targetMonth) return;

        const shop = shopMatch[1].trim();
        // サブスク除外
        if (SUBSCRIPTIONS.some(s => shop.toUpperCase().includes(s.toUpperCase()))) return;

        results.push({
          date: dateMatch[1].slice(5), // MM/DD
          shop: shop,
          amount: parseInt(amountMatch[1].replace(',', ''))
        });
      });
    });
  });

  if (results.length === 0) return '';

  // 利用日でソート
  results.sort((a, b) => a.date.localeCompare(b.date));

  const total = results.reduce((sum, r) => sum + r.amount, 0);
  const lines = results.map(r =>
    `${r.date}  ${r.shop.padEnd(20)}  ${r.amount.toLocaleString()}円`
  ).join('\n');

  return `【Mastercard一般利用（${targetMonth.slice(5)}月引き落とし分）】\n${lines}\n${'─'.repeat(36)}\n合計  ${total.toLocaleString()}円`;
}

function debugRakutenDetails() {
  console.log(getRakutenMastercardDetails());
}

function debugSubscriptions() {
  var result = getMastercardSubscriptions();
  result.list.forEach(function(sub) {
    console.log(sub.name + ' ' + sub.amount + '円 ' + sub.day + '日');
  });
}

function debugRakutenDetailsAll() {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const targetMonth = Utilities.formatDate(nextMonth, 'Asia/Tokyo', 'yyyy/MM');

  const threads = GmailApp.search(
    'from:rakuten-card.co.jp "カード利用お知らせメール(確定版)" newer_than:60d in:anywhere',
    0, 500
  );

  threads.forEach(thread => {
    thread.getMessages().forEach(msg => {
      const body = msg.getPlainBody();
      if (!body.includes('Mastercard')) return;

      const blocks = body.split('■利用日:').slice(1);
      blocks.forEach(block => {
        const dateMatch = block.match(/^\s*(\d{4}\/\d{2}\/\d{2})/);
        const shopMatch = block.match(/■利用先:\s*(.+)/);
        const amountMatch = block.match(/■利用金額:\s*([\d,]+)\s*円/);
        const monthMatch = block.match(/■支払月:\s*(\d{4}\/\d{2})/);

        if (!dateMatch || !shopMatch || !amountMatch || !monthMatch) return;
        if (monthMatch[1] !== targetMonth) return;

        console.log(dateMatch[1] + ' / ' + shopMatch[1].trim() + ' / ' + amountMatch[1] + '円');
      });
    });
  });
}

function debugRakutenBankMails() {
  var threads = GmailApp.search('from:rakuten-bank.co.jp newer_than:30d', 0, 20);
  console.log('件数: ' + threads.length);
  threads.forEach(function(thread) {
    var msg = thread.getMessages()[0];
    console.log('件名: ' + msg.getSubject());
  });
}

function debugRakutenBankDebit() {
  var threads = GmailApp.search(
    'from:rakuten-bank.co.jp subject:"デビットカードご利用通知" newer_than:30d',
    0, 20
  );
  threads.forEach(function(thread) {
    var msg = thread.getMessages()[0];
    console.log('件名: ' + msg.getSubject());
    console.log('本文:\n' + msg.getPlainBody().substring(0, 500));
    console.log('---');
  });
}

function debugAmazonDebit() {
  var threads = GmailApp.search(
    'from:rakuten-bank.co.jp subject:"デビットカードご利用通知" newer_than:30d',
    0, 20
  );
  threads.forEach(function(thread) {
    var msg = thread.getMessages()[0];
    var body = msg.getPlainBody();
    if (body.indexOf('AMAZON') === -1 && body.indexOf('Amazon') === -1) return;
    console.log('受信日: ' + msg.getDate());
    console.log('本文:\n' + body.substring(0, 500));
    console.log('---');
  });
}

function debugAmazonPayment() {
  var threads = GmailApp.search(
    'from:amazon.co.jp subject:"お支払い" newer_than:30d',
    0, 5
  );
  threads.forEach(function(thread) {
    var msg = thread.getMessages()[0];
    console.log('件名: ' + msg.getSubject());
    console.log('本文:\n' + msg.getPlainBody().substring(0, 500));
    console.log('---');
  });
}

function debugAmazonMails() {
  var threads = GmailApp.search(
    'from:amazon.co.jp newer_than:30d',
    0, 20
  );
  threads.forEach(function(thread) {
    var msg = thread.getMessages()[0];
    console.log('件名: ' + msg.getSubject());
  });
}

function debugAmazonOrder() {
  var threads = GmailApp.search(
    'from:amazon.co.jp "注文確認" newer_than:30d',
    0, 3
  );
  threads.forEach(function(thread) {
    var msg = thread.getMessages()[0];
    console.log('件名: ' + msg.getSubject());
    console.log('本文:\n' + msg.getPlainBody().substring(0, 800));
    console.log('---');
  });
}

function debugAmazonOrder2() {
  var threads = GmailApp.search(
    'from:amazon newer_than:30d (subject:"注文" OR subject:"ご注文")',
    0, 10
  );
  console.log('件数: ' + threads.length);
  threads.forEach(function(thread) {
    var msg = thread.getMessages()[0];
    console.log('件名: ' + msg.getSubject());
    console.log('差出人: ' + msg.getFrom());
  });
}

function debugAmazonOrderBody() {
  var threads = GmailApp.search(
    'from:amazon newer_than:30d subject:"注文済み"',
    0, 3
  );
  threads.forEach(function(thread) {
    var msg = thread.getMessages()[0];
    console.log('件名: ' + msg.getSubject());
    console.log('本文:\n' + msg.getPlainBody().substring(0, 800));
    console.log('---');
  });
}

function debugDebitMails() {
  // DMM
  var dmm = GmailApp.search('from:dmm.com newer_than:30d', 0, 3);
  console.log('DMM件数: ' + dmm.length);
  dmm.forEach(function(t) {
    var msg = t.getMessages()[0];
    console.log('件名: ' + msg.getSubject());
    console.log('本文:\n' + msg.getPlainBody().substring(0, 300));
    console.log('---');
  });

  // Amazonギフト券
  var gift = GmailApp.search('from:amazon newer_than:60d (subject:"ギフト券" OR subject:"チャージ")', 0, 3);
  console.log('Amazonギフト券件数: ' + gift.length);
  gift.forEach(function(t) {
    var msg = t.getMessages()[0];
    console.log('件名: ' + msg.getSubject());
    console.log('本文:\n' + msg.getPlainBody().substring(0, 300));
    console.log('---');
  });
}

function debugDebitMails() {
  // DMM
  var dmm = GmailApp.search('from:dmm.com newer_than:30d', 0, 3);
  console.log('DMM件数: ' + dmm.length);
  dmm.forEach(function(t) {
    var msg = t.getMessages()[0];
    console.log('件名: ' + msg.getSubject());
    console.log('本文:\n' + msg.getPlainBody().substring(0, 300));
    console.log('---');
  });

  // Amazonギフト券
  var gift = GmailApp.search('from:amazon newer_than:60d (subject:"ギフト券" OR subject:"チャージ")', 0, 3);
  console.log('Amazonギフト券件数: ' + gift.length);
  gift.forEach(function(t) {
    var msg = t.getMessages()[0];
    console.log('件名: ' + msg.getSubject());
    console.log('本文:\n' + msg.getPlainBody().substring(0, 300));
    console.log('---');
  });
}

function debugDMMMail() {
  var threads = GmailApp.search(
    'from:mail.video.dmm.co.jp newer_than:60d',
    0, 3
  );
  threads.forEach(function(thread) {
    var msg = thread.getMessages()[0];
    console.log('件名: ' + msg.getSubject());
    console.log('本文:\n' + msg.getPlainBody().substring(0, 500));
    console.log('---');
  });
}

function debugDebitAll() {
  var threads = GmailApp.search(
    'from:rakuten-bank.co.jp subject:"デビットカードご利用通知" newer_than:30d',
    0, 20
  );
  console.log('件数: ' + threads.length);
  threads.forEach(function(thread) {
    var msg = thread.getMessages()[0];
    console.log('受信日: ' + msg.getDate());
    console.log('本文:\n' + msg.getPlainBody().substring(0, 300));
    console.log('---');
  });
}

// ===== 楽天銀行デビットカード今月利用合計 =====
function getRakutenBankDebitTotal() {
  var today = new Date();
  var thisMonth = today.getFullYear() + '/' + ('0' + (today.getMonth() + 1)).slice(-2);
  
  var threads = GmailApp.search(
    'from:rakuten-bank.co.jp subject:"デビットカードご利用通知" newer_than:35d',
    0, 50
  );

  var total = 0;
  var items = [];

  threads.forEach(function(thread) {
    var msg = thread.getMessages()[0];
    var date = msg.getDate();
    var msgMonth = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM');
    if (msgMonth !== thisMonth) return;

    var body = msg.getPlainBody();
    var amountMatch = body.match(/■今回のご利用金額\s*\n\s*([\d,]+)円/);
    if (!amountMatch) return;

    var amount = parseInt(amountMatch[1].replace(/,/g, ''));
    var dateStr = Utilities.formatDate(date, 'Asia/Tokyo', 'MM/dd');
    total += amount;
    items.push({ date: dateStr, amount: amount });
  });

  items.sort(function(a, b) { return a.date.localeCompare(b.date); });

  return { total: total, items: items };
}

// ===== 自動既読 =====
function autoMarkAsRead() {
  var threads = GmailApp.search('is:unread -subject:"Gmail日次ダイジェスト"', 0, 500);
  if (threads.length > 0) {
    GmailApp.markThreadsRead(threads);
    console.log(threads.length + '件を既読にしました。');
  }
}

function debugCardMailCount() {
  var threads = GmailApp.search(
    'from:rakuten-card.co.jp "カード利用お知らせメール(確定版)" in:anywhere',
    0, 500
  );
  console.log('全期間の件数: ' + threads.length);
  threads.forEach(function(thread) {
    var msg = thread.getMessages()[0];
    console.log(Utilities.formatDate(msg.getDate(), 'Asia/Tokyo', 'yyyy/MM/dd') + ' ' + msg.getSubject());
  });
}

function debugGrokSection() {
  var threads = GmailApp.search('from:noreply@x.ai newer_than:1d', 0, 5);
  threads.forEach(function(thread) {
    var msg = thread.getMessages()[0];
    var body = msg.getPlainBody();
    console.log('文字数: ' + body.length);
    console.log(body);
  });
}
