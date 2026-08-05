import type { Journey, Locale, Session } from '@agapeplay/domain'

const frenchSessions: Session[] = [
  {
    id: 'repartir-01',
    day: 1,
    title: 'Revenir à l’essentiel',
    theme: 'Une foi qui respire',
    duration: 8,
    verse: '« Venez à moi, vous tous qui êtes fatigués et chargés, et je vous donnerai du repos. » — Matthieu 11:28',
    prompt: 'Qu’aimerais-tu déposer aujourd’hui avant de commencer ?',
    action: 'Prends deux minutes de silence, puis écris une phrase de prière honnête.',
  },
  {
    id: 'repartir-02',
    day: 2,
    title: 'Recevoir plutôt que réussir',
    theme: 'La grâce au quotidien',
    duration: 9,
    verse: '« Ma grâce te suffit, car ma puissance s’accomplit dans la faiblesse. » — 2 Corinthiens 12:9',
    prompt: 'Dans quel domaine te mets-tu le plus de pression ?',
    action: 'Partage une phrase simple avec ton tandem : « Aujourd’hui, je peux recevoir… »',
  },
  {
    id: 'repartir-03',
    day: 3,
    title: 'Faire un pas vers quelqu’un',
    theme: 'Une foi incarnée',
    duration: 7,
    verse: '« Portez les fardeaux les uns des autres. » — Galates 6:2',
    prompt: 'Qui pourrait avoir besoin d’une présence attentive cette semaine ?',
    action: 'Envoie un message d’encouragement sans attendre de réponse.',
  },
]

const englishSessions: Session[] = [
  {
    id: 'repartir-01',
    day: 1,
    title: 'Come back to what matters',
    theme: 'A breathing faith',
    duration: 8,
    verse: '“Come to me, all you who are weary and burdened, and I will give you rest.” — Matthew 11:28',
    prompt: 'What would you like to lay down before you begin today?',
    action: 'Take two quiet minutes, then write one honest sentence of prayer.',
  },
  {
    id: 'repartir-02',
    day: 2,
    title: 'Receive instead of achieving',
    theme: 'Grace in everyday life',
    duration: 9,
    verse: '“My grace is sufficient for you, for my power is made perfect in weakness.” — 2 Corinthians 12:9',
    prompt: 'Where do you put the most pressure on yourself?',
    action: 'Share one sentence with your tandem: “Today, I can receive…”',
  },
  {
    id: 'repartir-03',
    day: 3,
    title: 'Take one step toward someone',
    theme: 'A faith you can live',
    duration: 7,
    verse: '“Carry each other’s burdens.” — Galatians 6:2',
    prompt: 'Who might need a listening presence this week?',
    action: 'Send an encouraging message without expecting a reply.',
  },
]

export const getJourney = (locale: Locale): Journey => ({
  id: 'repartir-avec-jesus',
  title: locale === 'fr' ? 'Repartir avec Jésus' : 'Starting again with Jesus',
  eyebrow: locale === 'fr' ? 'Parcours AgapePlay' : 'AgapePlay journey',
  description:
    locale === 'fr'
      ? 'Six semaines pour retrouver un rythme simple, concret et accompagné.'
      : 'Six weeks to find a simple, practical rhythm with someone beside you.',
  duration: locale === 'fr' ? '6 semaines · 10 min par jour' : '6 weeks · 10 min a day',
  sessions: locale === 'fr' ? frenchSessions : englishSessions,
})

