-- Le parcours « Repartir avec Jésus », en entier — issue #8.
--
-- Le doc 07 décrit six semaines de cinq séances et une discussion
-- hebdomadaire ; la base n'en portait que trois jours depuis le 04/08. Cette
-- migration écrit les vingt-sept séances manquantes et retouche deux des trois
-- existantes. Aucun changement de schéma, aucune politique.
--
-- ## Les traductions : domaine public, des deux côtés
--
-- FR = Louis Segond 1910. EN = World English Bible. Le doc 07 impose que les
-- droits du texte biblique soient vérifiés, et le doc 24 explique pourquoi le
-- domaine public est la seule réponse tenable ici : un parcours versionné et
-- traduit qui s'appuierait sur une version sous contrat hériterait d'une date
-- d'expiration qu'il ne contrôle pas.
--
-- **Deux des trois citations anglaises existantes n'étaient pas du domaine
-- public.** `repartir-01` (« Come to me, all you who are weary and burdened »)
-- et `repartir-03` (« Carry each other's burdens ») reprenaient mot pour mot
-- la New International Version, sous copyright. Elles sont remplacées ici par
-- la WEB. `repartir-02` était déjà identique à la WEB et n'est pas touchée.
-- Les trois `verse_fr` ont été vérifiés dans la même passe : ils sont déjà
-- Segond 1910 au mot près.
--
-- ## Vérification des citations
--
-- Aucune citation n'a été écrite de mémoire. Les trente-quatre textes (trente
-- séances plus les trois versets de mémorisation, plus les contrôles) ont été
-- récupérés aux sources — api.getbible.net/v2/ls1910 pour le français,
-- bible-api.com?translation=web pour l'anglais — et chaque extrait cité est
-- une plage contiguë du verset source, ponctuation de fin et guillemets mis à
-- part. Le nom du livre retourné par chaque source a été comparé à celui écrit
-- ici, pour attraper un éventuel décalage de numérotation.
--
-- ## La structure
--
-- Six semaines de cinq séances, `semaine = ceil(day / 5)`. La cinquième séance
-- de chaque semaine (jours 5, 10, 15, 20, 25, 30) est la discussion de binôme
-- du doc 07 : son action envoie vers la conversation du tandem, et sa question
-- se répond à deux. Les objectifs de semaine sont ceux du tableau du doc 07,
-- dans l'ordre.
--
-- ## Les trois versets de mémorisation — proposition, à valider
--
-- Le doc 24 fixe la forme de la semaine 4 : un verset choisi par le
-- participant dans une liste de trois, court, tenant hors contexte, recopié à
-- la main au jour 1, retapé de mémoire au jour 3, dit au binôme au jour 5.
-- Ce sont ici les jours 16, 18 et 20.
--
-- Les trois proposés : Psaumes 119:105, Ésaïe 41:10, Jean 14:27. Le doc 24
-- les note comme une décision humaine ; ils restent donc **une proposition
-- qui attend un relecteur**, et le doc 21 le dit.
--
-- Psaumes 23:1 avait été retenu d'abord, puis écarté : la WEB y rend le nom
-- divin par « Yahweh », vocalisation que plusieurs traditions évitent. Le
-- parcours doit se lire sans accroc par un jeune catholique comme protestant.
--
-- ## Le pont Versets Flash n'apparaît pas ici
--
-- Le doc 24 prévoyait une ligne vers Versets Flash au bas de la séance du jour
-- 16. Elle n'est pas écrite : la mémorisation se fait avec le journal et le
-- binôme, et rien du parcours ne doit dépendre d'une autre application. Le
-- pont reste une décision d'écosystème, pas de contenu.

update public.content_sessions
set verse_en = '“Come to me, all you who labor and are heavily burdened, and I will give you rest.” — Matthew 11:28'
where id = 'repartir-01';

update public.content_sessions
set verse_en = '“Bear one another’s burdens.” — Galatians 6:2'
where id = 'repartir-03';

insert into public.content_sessions (id, journey_id, day, title_fr, title_en, theme_fr, theme_en, duration, verse_fr, verse_en, prompt_fr, prompt_en, action_fr, action_en)
values

-- Semaine 1 — Faire le point (jours 1 à 5 ; 1 à 3 existent déjà)
('repartir-04', 'repartir-avec-jesus', 4, 'Ce que tu portes sans le dire', 'What you carry without saying it', 'Faire le point', 'Taking stock', 8, '« Sonde-moi, ô Dieu, et connais mon cœur ! » — Psaumes 139:23', '“Search me, God, and know my heart.” — Psalm 139:23', 'Qu’est-ce que tu n’as dit à personne cette semaine ?', 'What have you told no one this week?', 'Écris-le dans ton journal. Personne ne le lira.', 'Write it in your journal. No one will read it.'),
('repartir-05', 'repartir-avec-jesus', 5, 'Le premier échange', 'Your first exchange', 'La discussion de la semaine', 'This week’s conversation', 10, '« Deux valent mieux qu’un. » — Ecclésiaste 4:9', '“Two are better than one.” — Ecclesiastes 4:9', 'Qu’est-ce que tu attends de ces six semaines, honnêtement ?', 'What do you actually hope will come out of these six weeks?', 'Ouvre la conversation avec ton binôme et dis-lui ce que tu viens d’écrire.', 'Open the conversation with your tandem and tell them what you just wrote.'),

-- Semaine 2 — Comprendre l’Évangile (jours 6 à 10)
('repartir-06', 'repartir-avec-jesus', 6, 'La phrase que tout le monde connaît', 'The verse everyone has heard', 'Comprendre l’Évangile', 'Understanding the gospel', 8, '« Dieu a tant aimé le monde qu’il a donné son Fils unique. » — Jean 3:16', '“God so loved the world, that he gave his one and only Son.” — John 3:16', 'Si tu devais la redire à quelqu’un qui ne l’a jamais entendue, tu dirais quoi ?', 'If you had to say it to someone who had never heard it, how would it come out?', 'Écris-la avec tes mots dans ton journal. Une phrase suffit.', 'Write it in your own words in your journal. One sentence is enough.'),
('repartir-07', 'repartir-avec-jesus', 7, 'Avant que tu sois prêt', 'Before you were ready', 'Comprendre l’Évangile', 'Understanding the gospel', 8, '« Lorsque nous étions encore des pécheurs, Christ est mort pour nous. » — Romains 5:8', '“While we were yet sinners, Christ died for us.” — Romans 5:8', 'Qu’est-ce que ça change, qu’il n’ait pas attendu que tu sois en règle ?', 'What changes if he didn’t wait for you to get your life in order?', 'Note la première réaction qui te vient, même si c’est du doute.', 'Write down your first reaction, doubt included.'),
('repartir-08', 'repartir-avec-jesus', 8, 'Rien à rembourser', 'Nothing to pay back', 'Comprendre l’Évangile', 'Understanding the gospel', 9, '« C’est par la grâce que vous êtes sauvés, par le moyen de la foi. » — Éphésiens 2:8', '“By grace you have been saved through faith.” — Ephesians 2:8', 'À quoi ressemblerait ta journée si tu n’avais rien à prouver à Dieu ?', 'What would today look like if you had nothing to prove to God?', 'Repère une chose que tu fais surtout pour te rassurer, et laisse-la de côté aujourd’hui.', 'Find one thing you do mainly to reassure yourself, and leave it alone today.'),
('repartir-09', 'repartir-avec-jesus', 9, 'Le père qui court', 'The father who runs', 'Comprendre l’Évangile', 'Understanding the gospel', 10, '« Son père le vit et fut ému de compassion. » — Luc 15:20', '“His father saw him, and was moved with compassion.” — Luke 15:20', 'Qu’est-ce qui te retient de revenir, quand tu t’es éloigné ?', 'When you drift, what makes coming back hard?', 'Lis Luc 15, des versets 11 à 24, sans rien noter.', 'Read Luke 15:11-24, without writing anything down.'),
('repartir-10', 'repartir-avec-jesus', 10, 'Ce que tu crois sur toi', 'What you believe about yourself', 'La discussion de la semaine', 'This week’s conversation', 10, '« Il n’y a donc maintenant aucune condamnation pour ceux qui sont en Jésus-Christ. » — Romains 8:1', '“There is therefore now no condemnation to those who are in Christ Jesus.” — Romans 8:1', 'Qu’est-ce que tu n’arrives pas à croire dans cette phrase ?', 'What part of that sentence can’t you believe yet?', 'Pose ta question à ton binôme dans la conversation, même si elle te paraît bête.', 'Ask your tandem that question in the conversation, even if it feels stupid.'),

-- Semaine 3 — Développer la prière (jours 11 à 15)
('repartir-11', 'repartir-avec-jesus', 11, 'Une porte fermée', 'A door you can shut', 'Développer la prière', 'Learning to pray', 7, '« Quand tu pries, entre dans ta chambre, ferme ta porte. » — Matthieu 6:6', '“When you pray, enter into your inner room, and having shut your door.” — Matthew 6:6', 'Où est-ce que tu peux t’isoler deux minutes, chez toi ?', 'Where can you be alone for two minutes at home?', 'Va à cet endroit maintenant et restes-y deux minutes, sans ton téléphone.', 'Go there now and stay two minutes, phone left behind.'),
('repartir-12', 'repartir-avec-jesus', 12, 'Dire ce qui inquiète', 'Saying what worries you', 'Développer la prière', 'Learning to pray', 8, '« En toute chose faites connaître vos besoins à Dieu. » — Philippiens 4:6', '“Let your requests be made known to God.” — Philippians 4:6', 'Qu’est-ce qui t’inquiète en ce moment, précisément ?', 'What exactly is worrying you right now?', 'Écris-le comme si tu le disais à quelqu’un : « Voilà ce qui me pèse… »', 'Write it as if you were telling someone: “Here’s what’s weighing on me…”'),
('repartir-13', 'repartir-avec-jesus', 13, 'Personne ne sait prier tout seul', 'Nobody figures prayer out alone', 'Développer la prière', 'Learning to pray', 7, '« Seigneur, enseigne-nous à prier. » — Luc 11:1', '“Lord, teach us to pray.” — Luke 11:1', 'Quand tu essaies de prier, qu’est-ce qui bloque ?', 'When you try to pray, where does it get stuck?', 'Choisis un moment fixe pour prier demain, et note-le.', 'Pick a set time to pray tomorrow, and write it down.'),
('repartir-14', 'repartir-avec-jesus', 14, 'Ce qui s’est bien passé', 'What went right', 'Développer la prière', 'Learning to pray', 7, '« Rendez grâces en toutes choses. » — 1 Thessaloniciens 5:18', '“In everything give thanks.” — 1 Thessalonians 5:18', 'Qu’est-ce qui s’est bien passé aujourd’hui, même de tout petit ?', 'What went right today, however small?', 'Écris trois choses pour lesquelles tu peux dire merci ce soir.', 'Write down three things you can say thank you for tonight.'),
('repartir-15', 'repartir-avec-jesus', 15, 'Prier pour quelqu’un d’autre', 'Praying for someone else', 'La discussion de la semaine', 'This week’s conversation', 10, '« Priez les uns pour les autres. » — Jacques 5:16', '“Pray for one another.” — James 5:16', 'Pour quoi aimerais-tu que ton binôme prie cette semaine ?', 'What would you like your tandem to pray about this week?', 'Demande-le-lui dans la conversation, et pose-lui la même question.', 'Ask them in the conversation, and ask them the same question back.'),

-- Semaine 4 — Lire et mémoriser la Bible (jours 16 à 20 ; le geste de
-- mémorisation du doc 24 tombe aux jours 16, 18 et 20)
('repartir-16', 'repartir-avec-jesus', 16, 'Choisir sa phrase', 'Choosing your sentence', 'Lire et mémoriser la Bible', 'Reading and remembering', 10, '« Et ces commandements, que je te donne aujourd’hui, seront dans ton cœur. » — Deutéronome 6:6', '“These words, which I command you today, shall be on your heart.” — Deuteronomy 6:6', 'Quelle phrase de la Bible aimerais-tu avoir en tête le jour où ça va mal ?', 'Which line from the Bible would you want in your head on a bad day?', 'Choisis une des trois : « Ta parole est une lampe à mes pieds » (Psaumes 119:105), « Ne crains rien, car je suis avec toi » (Ésaïe 41:10), « Je vous laisse la paix, je vous donne ma paix » (Jean 14:27). Recopie-la à la main dans ton journal.', 'Pick one of these three: “Your word is a lamp to my feet” (Psalm 119:105), “Don’t you be afraid, for I am with you” (Isaiah 41:10), “Peace I leave with you. My peace I give to you” (John 14:27). Copy it out in full in your journal.'),
('repartir-17', 'repartir-avec-jesus', 17, 'Là où on la range', 'Where you keep it', 'Lire et mémoriser la Bible', 'Reading and remembering', 7, '« Je serre ta parole dans mon cœur. » — Psaumes 119:11', '“I have hidden your word in my heart.” — Psalm 119:11', 'Qu’est-ce qui t’a fait choisir cette phrase-là hier ?', 'What made you pick that particular line yesterday?', 'Relis-la trois fois à voix basse, puis referme le journal.', 'Read it three times under your breath, then close the journal.'),
('repartir-18', 'repartir-avec-jesus', 18, 'Sans regarder', 'Without looking', 'Lire et mémoriser la Bible', 'Reading and remembering', 8, '« Médite-le jour et nuit. » — Josué 1:8', '“You shall meditate on it day and night.” — Joshua 1:8', 'Qu’est-ce que tu en retiens, là, sans la relire ?', 'What do you have of it right now, without looking?', 'Écris ta phrase de mémoire dans le journal, puis regarde l’original. Rien n’est compté.', 'Write your line from memory in the journal, then look at the original. Nothing is being scored.'),
('repartir-19', 'repartir-avec-jesus', 19, 'Ce qui tient', 'What holds', 'Lire et mémoriser la Bible', 'Reading and remembering', 8, '« Quiconque entend ces paroles que je dis et les met en pratique. » — Matthieu 7:24', '“Everyone therefore who hears these words of mine, and does them.” — Matthew 7:24', 'Ta phrase changerait quoi dans ta semaine, si tu la prenais au sérieux ?', 'If you took your line seriously, what would change this week?', 'Repère un moment précis de demain où tu te la rediras.', 'Pick one exact moment tomorrow when you’ll say it to yourself.'),
('repartir-20', 'repartir-avec-jesus', 20, 'La dire à quelqu’un', 'Saying it out loud', 'La discussion de la semaine', 'This week’s conversation', 10, '« Notre cœur ne brûlait-il pas au dedans de nous ? » — Luc 24:32', '“Weren’t our hearts burning within us?” — Luke 24:32', 'Pourquoi cette phrase-là, et pas une autre ?', 'Why that line, and not another one?', 'Dis ta phrase de mémoire à ton binôme dans la conversation, et écoute la sienne.', 'Say your line from memory to your tandem in the conversation, and listen to theirs.'),

-- Semaine 5 — Grandir avec les autres (jours 21 à 25)
('repartir-21', 'repartir-avec-jesus', 21, 'Qui remarque', 'Who notices', 'Grandir avec les autres', 'Growing alongside others', 7, '« Veillons les uns sur les autres. » — Hébreux 10:24', '“Let us consider how to provoke one another to love and good works.” — Hebrews 10:24', 'Qui remarque quand tu ne vas pas bien ?', 'Who notices when you’re not doing well?', 'Écris le prénom d’une personne qui compte pour toi, et pourquoi.', 'Write down the first name of someone who matters to you, and why.'),
('repartir-22', 'repartir-avec-jesus', 22, 'Écouter d’abord', 'Listening first', 'Grandir avec les autres', 'Growing alongside others', 8, '« Que tout homme soit prompt à écouter, lent à parler. » — Jacques 1:19', '“Let every man be swift to hear, slow to speak.” — James 1:19', 'Dans quelle conversation récente as-tu parlé plus que tu n’as écouté ?', 'In what recent conversation did you talk more than you listened?', 'Aujourd’hui, dans une conversation, pose une question de plus avant de répondre.', 'Today, in one conversation, ask one more question before you answer.'),
('repartir-23', 'repartir-avec-jesus', 23, 'Ce qui n’est pas réglé', 'What’s still unsettled', 'Grandir avec les autres', 'Growing alongside others', 9, '« Pardonnez-vous réciproquement. » — Colossiens 3:13', '“Forgiving each other.” — Colossians 3:13', 'À qui en veux-tu encore, même un peu ?', 'Who are you still holding something against, even a little?', 'Écris son prénom dans ton journal, et une phrase de prière pour cette personne.', 'Write their first name in your journal, and one sentence of prayer for them.'),
('repartir-24', 'repartir-avec-jesus', 24, 'La joie des autres', 'Someone else’s good news', 'Grandir avec les autres', 'Growing alongside others', 8, '« Réjouissez-vous avec ceux qui se réjouissent. » — Romains 12:15', '“Rejoice with those who rejoice.” — Romans 12:15', 'Qu’est-ce que tu envies à quelqu’un que tu connais ?', 'What are you jealous of, in someone you know?', 'Envoie à cette personne un message de félicitations, sans rien ajouter d’autre.', 'Send that person a message saying congratulations, and nothing else.'),
('repartir-25', 'repartir-avec-jesus', 25, 'Ne pas rester seul', 'Not staying on your own', 'La discussion de la semaine', 'This week’s conversation', 10, '« Ils persévéraient dans l’enseignement des apôtres, dans la communion fraternelle. » — Actes 2:42', '“They continued steadfastly in the apostles’ teaching and fellowship.” — Acts 2:42', 'Où pourrais-tu rencontrer d’autres chrétiens près de chez toi ?', 'Where could you meet other Christians near you?', 'Cherchez ensemble, dans la conversation, un endroit où l’un de vous deux pourrait aller ce mois-ci.', 'Look together, in the conversation, for one place either of you could go this month.'),

-- Semaine 6 — Servir et transmettre (jours 26 à 30)
('repartir-26', 'repartir-avec-jesus', 26, 'Ce que tu sais faire', 'What you’re good at', 'Servir et transmettre', 'Serving and passing it on', 8, '« Que chacun de vous mette au service des autres le don qu’il a reçu. » — 1 Pierre 4:10', '“As each has received a gift, employ it in serving one another.” — 1 Peter 4:10', 'Qu’est-ce qu’on vient te demander, d’habitude ?', 'What do people usually come to you for?', 'Écris deux choses que tu sais faire, même si elles te paraissent banales.', 'Write down two things you’re good at, even if they seem ordinary.'),
('repartir-27', 'repartir-avec-jesus', 27, 'Servir sans le dire', 'Serving without saying so', 'Servir et transmettre', 'Serving and passing it on', 7, '« Le Fils de l’homme est venu, non pour être servi, mais pour servir. » — Marc 10:45', '“The Son of Man also came not to be served, but to serve.” — Mark 10:45', 'Qu’est-ce que tu pourrais faire aujourd’hui qui n’arrangerait que quelqu’un d’autre ?', 'What could you do today that only helps someone else?', 'Fais-le aujourd’hui, et ne le raconte à personne.', 'Do it today, and tell no one.'),
('repartir-28', 'repartir-avec-jesus', 28, 'Sans faire un discours', 'Without making a speech', 'Servir et transmettre', 'Serving and passing it on', 7, '« Que votre lumière luise ainsi devant les hommes. » — Matthieu 5:16', '“Let your light shine before men.” — Matthew 5:16', 'Est-ce que les gens autour de toi savent que tu crois ?', 'Do the people around you know that you believe?', 'Ne change rien à ta journée. Note juste, ce soir, un moment où ta foi s’est vue.', 'Change nothing about your day. Tonight, just note one moment where your faith showed.'),
('repartir-29', 'repartir-avec-jesus', 29, 'Si on te demande', 'If someone asks', 'Servir et transmettre', 'Serving and passing it on', 9, '« Toujours prêts à vous défendre, avec douceur et respect. » — 1 Pierre 3:15', '“Always be ready to give an answer to everyone who asks.” — 1 Peter 3:15', 'Si on te demandait pourquoi tu crois, tu répondrais quoi ?', 'If someone asked why you believe, what would you say?', 'Écris ta réponse en deux phrases. C’est un brouillon, pas une réponse finale.', 'Write your answer in two sentences. It’s a draft, not a final answer.'),
('repartir-30', 'repartir-avec-jesus', 30, 'Et après ?', 'And after this?', 'La discussion de la semaine', 'This week’s conversation', 10, '« Celui qui a commencé en vous cette bonne œuvre la rendra parfaite. » — Philippiens 1:6', '“He who began a good work in you will complete it.” — Philippians 1:6', 'Qu’est-ce qui a changé en six semaines, et qu’est-ce que tu veux garder ?', 'What changed in six weeks, and what do you want to keep?', 'Décidez ensemble d’une seule chose que vous continuez après ce parcours.', 'Decide together on one thing you’ll keep doing after this journey.')

on conflict (id) do update set title_fr = excluded.title_fr, title_en = excluded.title_en, theme_fr = excluded.theme_fr, theme_en = excluded.theme_en, duration = excluded.duration, verse_fr = excluded.verse_fr, verse_en = excluded.verse_en, prompt_fr = excluded.prompt_fr, prompt_en = excluded.prompt_en, action_fr = excluded.action_fr, action_en = excluded.action_en;
