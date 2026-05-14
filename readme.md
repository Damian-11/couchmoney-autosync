# couchmoney autosync

While [couchmoney](https://couchmoney.tv) is an excellent recommendation engine, it has one major problem:
By default, couchmoney will only synchronize your recommendation catalogs after you have _rated_ a movie or show. This becomes problematic if you have your recommendations set up based on recently watched content -- if you rarely rate, your catalogs will almost never be updated and your recommendations will get stale.

This program provides a solution by allowing you to trigger updates to your recommendations on a fixed interval, ensuring you always get the latest & freshest watch suggestions.

> [!NOTE]
> Couchmoney works best when you actively submit ratings. I made this program for passive, Trakt scrobbling-enabled setups (i.e. ones you configure once and leave running), making it ideal for friends or family members who want decent recommendations without the hassle of manually rating movies on Trakt.

## How to Run (Docker)

This program is designed to be run as a Docker container. First, download the `compose.yaml` file with from this repository:

```
curl -O https://raw.githubusercontent.com/Damian-11/couchmoney-autosync/refs/heads/master/compose.yaml
```

Then, download the `.env.example` file and fill out the required settings:

```
curl -o .env https://raw.githubusercontent.com/Damian-11/couchmoney-autosync/refs/heads/master/.env.example
# Edit the .env file
```

Finally, start the container:

```
docker compose up -d
```

After the container starts, make sure to check the logs to verify that everything is working correctly.
