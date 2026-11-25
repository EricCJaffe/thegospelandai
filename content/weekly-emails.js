// Weekly email sequence: one email a week for ten weeks, one per chapter of
// "Anchored in the Storm". DRAFT copy for Eric's review and rewrite.
//
// BUILDER ONLY. Nothing in this repo sends these. Sending needs a provider,
// a list decision and Eric's separate yes; until then the admin page previews.
//
// Every verse reference is checked by test/weekly-emails.test.js.
export const WEEKLY_EMAILS = [
  {
    week: 1, chapter: 'The Gospel: God\'s grand story',
    subject: 'Before the headlines: the story we are in',
    preheader: 'Creation, fall, redemption, restoration, and where AI fits.',
    verse: { ref: 'Colossians 1:16-17', text: 'All things were created through him and for him. And he is before all things, and in him all things hold together.' },
    body: [
      'Every week brings a new AI headline, and most of them are written as if the story started last Tuesday. It did not.',
      'Scripture gives us the whole arc: God made a good world, we broke it, Christ redeemed it, and He will make all things new. Every question about AI lands somewhere on that line.',
      'This week, read a tech headline and ask one question: which part of the story is this about?',
    ],
  },
  {
    week: 2, chapter: 'Biblical foreshadowings',
    subject: 'Babel had a tech stack too',
    preheader: 'The oldest lie, wearing new clothes.',
    verse: { ref: 'Genesis 11:4', text: 'Come, let us build ourselves a city and a tower with its top in the heavens, and let us make a name for ourselves.' },
    body: [
      'The tower of Babel was not a story about bricks. It was about people using their best technology to make a name for themselves apart from God.',
      'The tools have changed. The temptation has not: "you will be like God" is still the pitch.',
      'This week, notice where a product promises you something only God can give.',
    ],
  },
  {
    week: 3, chapter: 'The singularity and the shadow of eternity',
    subject: 'Digital immortality and the hope that actually holds',
    preheader: 'Why uploading your mind is a smaller hope than resurrection.',
    verse: { ref: '1 Corinthians 15:54', text: 'Death is swallowed up in victory.' },
    body: [
      'Some of the brightest minds alive are working to make death optional. That is a confession that they know something is wrong.',
      'The Gospel names it and answers it. Our hope is not a backup copy of ourselves; it is a risen Christ and a resurrection body.',
      'This week, talk with someone about what they hope for after death, and listen first.',
    ],
  },
  {
    week: 4, chapter: 'Headlines from 2035',
    subject: 'A letter from ten years out',
    preheader: 'Imagining the near future without fear.',
    verse: { ref: 'Isaiah 41:10', text: 'Fear not, for I am with you; be not dismayed, for I am your God.' },
    body: [
      'Picture the news a decade from now. Some of it will be wonderful and some of it will be hard.',
      'Christians do not need to predict the future to face it. We know who holds it.',
      'This week, write down one fear about the future and the promise of God that answers it.',
    ],
  },
  {
    week: 5, chapter: 'AI frontiers and economic shockwaves',
    subject: 'When the job changes, your calling does not',
    preheader: 'Work, identity and what AI cannot take.',
    verse: { ref: 'Colossians 3:23', text: 'Whatever you do, work heartily, as for the Lord and not for men.' },
    body: [
      'AI will change what many of us do for a living. That is unsettling, especially if our job is where our identity lives.',
      'Your work matters, but it was never the deepest thing about you. You are a child of God before you are a role on an org chart.',
      'This week, name one skill AI cannot replace in you: patience, presence, wisdom, love.',
    ],
  },
  {
    week: 6, chapter: 'AI and finance',
    subject: 'Stewardship when the machines are trading',
    preheader: 'Faithful with much, faithful with little.',
    verse: { ref: 'Luke 16:10', text: 'One who is faithful in a very little is also faithful in much.' },
    body: [
      'Algorithms now move most of the money in the world. The call to steward what God gives us has not moved at all.',
      'Faithful stewardship is less about beating the market and more about open hands: giving, saving, and refusing to let fear or greed drive.',
      'This week, review one recurring expense or gift with that question: is this faithful?',
    ],
  },
  {
    week: 7, chapter: 'Guarding family and health',
    subject: 'A tech covenant for your home',
    preheader: 'Simple guardrails that protect the people you love.',
    verse: { ref: 'Joshua 24:15', text: 'As for me and my house, we will serve the Lord.' },
    body: [
      'The most powerful technology in your home is the one that is always in someone\'s hand.',
      'A family tech covenant is not a list of rules. It is a shared promise about what you will protect: meals, sleep, worship and each other.',
      'This week, pick one guardrail as a family and try it for seven days.',
    ],
  },
  {
    week: 8, chapter: 'Equipping the next generation',
    subject: 'Our kids will grow up with AI. Will they grow up with God?',
    preheader: 'Raising children who are wise, not just fluent.',
    verse: { ref: 'Proverbs 22:6', text: 'Train up a child in the way he should go; even when he is old he will not depart from it.' },
    body: [
      'Children will learn to use AI with or without us. What they need from us is wisdom about when not to.',
      'Teach them to ask where an answer came from, to check it against Scripture, and to bring their real questions to real people.',
      'This week, ask a child or grandchild what they use AI for, and what they would never ask it.',
    ],
  },
  {
    week: 9, chapter: 'Harnessing AI for kingdom impact',
    subject: 'The same tools, pointed at the Great Commission',
    preheader: 'Translation, discipleship and service at new scale.',
    verse: { ref: 'Matthew 28:19', text: 'Go therefore and make disciples of all nations.' },
    body: [
      'Every powerful technology in history, from roads to the printing press, has also carried the Gospel further.',
      'AI can help translate Scripture, equip pastors and serve the poor. Used with discernment, it can be a tool in faithful hands.',
      'This week, think of one way your church or ministry could use these tools to serve someone.',
    ],
  },
  {
    week: 10, chapter: 'Rising like Nehemiah',
    subject: 'Build the wall, and keep a sword in the other hand',
    preheader: 'Leadership for a church facing the storm.',
    verse: { ref: 'Nehemiah 4:17', text: 'Each labored on the work with one hand and held his weapon with the other.' },
    body: [
      'Nehemiah did not wait for perfect conditions. He prayed, planned, and rebuilt while opposition watched.',
      'The church does not need to fear this moment. It needs people willing to build, with prayer in one hand and wisdom in the other.',
      'This week, ask God where He is calling you to lead, and take one step.',
    ],
  },
];
