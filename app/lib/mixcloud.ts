export type PastShow = {
  key: string;
  url: string;
  image: string;
  name: string;
  date?: string;
};

type MixcloudCloudcast = {
  key: string;
  url: string;
  name: string;
  pictures: { large: string };
};

const PAST_SHOWS_URL = "https://api.mixcloud.com/radiomantis/cloudcasts/?limit=200";

export async function fetchPastShows(): Promise<PastShow[]> {
  const response = await fetch(PAST_SHOWS_URL);
  if (!response.ok) throw new Error(`Mixcloud fetch failed: ${response.status}`);
  const { data }: { data: MixcloudCloudcast[] } = await response.json();

  return data.map((show) => {
    const [name, date] = show.name.split(" - ");
    return { key: show.key, url: show.url, image: show.pictures.large, name, date };
  });
}
