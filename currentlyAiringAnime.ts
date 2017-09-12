export type Season = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL'

export type MediaSort =
  'ID' |
  'ID_DESC' |
  'TITLE_ROMAJI' |
  'TITLE_ROMAJI_DESC' |
  'TITLE_ENGLISH' |
  'TITLE_ENGLISH_DESC' |
  'TITLE_NATIVE' |
  'TITLE_NATIVE_DESC' |
  'TYPE' |
  'TYPE_DESC' |
  'FORMAT' |
  'FORMAT_DESC' |
  'START_DATE' |
  'START_DATE_DESC' |
  'END_DATE' |
  'END_DATE_DESC' |
  'SCORE' |
  'SCORE_DESC' |
  'POPULARITY' |
  'POPULARITY_DESC' |
  'EPISODES' |
  'EPISODES_DESC' |
  'DURATION' |
  'DURATION_DESC' |
  'STATUS' |
  'STATUS_DESC' |
  'UPDATED_AT' |
  'UPDATED_AT_DESC';

export type Options = {
  malIdIn?: number | number[]
  aniIdIn?: number | number[]
  userId?: number | number[]
  season?: Season | false
  includeLeftovers?: boolean,
  seasonYear?: number | number[] | false
  sort?: [string]
}

type PageInfo = {
  total: number
  currentPage: number
  lastPage: number
  hasNextPage: boolean
  perPage: number
}

export type AiringEpisode = {
  id: number
  episode: number
  airingAt: number
  timeUntilAiring: number
}

export type Media = {
  id: number
  idMal: number
  title: {
    romaji: string
    english: string
    native: string
  }
  studios: {
    edges: {
      node: {
        name: string
      }
    }[]
  }
  genres: string[]
  status: 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED'
  coverImage: {
    large: string
  }
  episodes: number
  nextAiringEpisode: AiringEpisode
  airingSchedule: {
    edges: {
      node: AiringEpisode
    }[]
  }
}

type ApiResponse = {
  data: {
    Page: {
      pageInfo: PageInfo
      media: Media[]
    }
  } | null
  errors?: {
    message: string
  }[]
}

export type AiringAnime = {
  shows: Media[],
  next: () => Promise<AiringAnime> | null
}

const apiEndpoint = 'https://graphql.anilist.co'

const requestOptions = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
}

const getAiringAnimeQuery = (includeSchedule: boolean = false) => `
  query (
    $page: Int
    $season: MediaSeason
		$seasonYear: Int
		$malIdIn: [Int]
		$aniIdIn: [Int]
    $sort: [MediaSort],
    $status: MediaStatus
  ) {
    Page (page: $page) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
        perPage
      }

      media(
				season: $season,
				seasonYear: $seasonYear
				idMal_in: $malIdIn,
				id_in: $aniIdIn,
        sort: $sort,
        status: $status
			) {
        id
        description
        idMal
        title {
          romaji
          native
          english
        }
        studios {
          edges {
            node {
              name
            }
          }
				}
				format
        genres
        status
        coverImage {
          large
        }
        episodes
        nextAiringEpisode {
          id
          episode
          airingAt
          timeUntilAiring
        }
        ${includeSchedule ? `
          airingSchedule {
            edges {
              node {
                episode
                airingAt
                timeUntilAiring
              }
            }
          }
        ` : ''}
      }
    }
  }
`

const leftoverQuery = ``;

// WINTER: Months December to February
// SPRING: Months March to Spring
// SUMMER: Months June to August
// FALL: Months September to November
function getCurrentSeason(): Season {
  const month = (new Date()).getMonth() + 1 // Add 1 because getMonth starts a 0

  if (month === 12 || (month >= 1 && month <= 2)) {
    return 'WINTER'
  }

  if (month >= 3 && month <= 5) {
    return 'SPRING'
  }

  if (month >= 6 && month <= 8) {
    return 'SUMMER'
  }

  return 'FALL'
}

function getCurrentSeasonYear(): number {
  return (new Date()).getFullYear()
}

async function sendFetchRequest(variables: object): Promise<ApiResponse> {
  const fetchOptions = Object.assign(requestOptions, {
    body: JSON.stringify({ query: getAiringAnimeQuery(), variables })
  })

  const response = await fetch(apiEndpoint, fetchOptions)

  const result = await response.json() as ApiResponse

  if (result.errors) {
    throw new Error(result.errors[0].message)
  }

  return result
}

async function currentlyAiringAnime(options: Options = {}): Promise<AiringAnime> {
  const amountOfOptions = Object.keys(options).length;
  if (!amountOfOptions || (amountOfOptions === 1 && options.sort !== undefined)) {
    options.season = getCurrentSeason()
    options.seasonYear = getCurrentSeasonYear()
  }

  options.malIdIn = options.malIdIn || undefined
  options.aniIdIn = options.aniIdIn || undefined
  options.sort = options.sort || ['START_DATE'];

  if (options.malIdIn !== undefined && !Array.isArray(options.malIdIn)) {
    throw new Error('malIdIn should be an array')
  }

  if (options.aniIdIn !== undefined && !Array.isArray(options.aniIdIn)) {
    throw new Error('malIdIn should be an array')
  }

  function makeRequestFactory(page: number = 1): () => Promise<AiringAnime> {

    return async function makeRequest() {
      const requestOptions = {
        page: page,
        malIdIn: options.malIdIn,
        aniIdIn: options.aniIdIn,
        sort: options.sort
      }

      if (options.season && options.seasonYear) {
        requestOptions['season'] = options.season
        requestOptions['seasonYear'] = options.seasonYear
      }

      const { data } = await sendFetchRequest(requestOptions)

      const hasNextPage = data.Page.pageInfo.hasNextPage

      page++

      return {
        shows: data.Page.media,
        next: hasNextPage ? makeRequest : null
      }
    }
  }

  return await makeRequestFactory()()
}

export default currentlyAiringAnime
