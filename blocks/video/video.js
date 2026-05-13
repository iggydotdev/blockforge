/*
 * Video Block
 * Show a video referenced by a link
 * https://www.hlx.live/developer/block-collection/video
 */

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/**
 * Determines the video source type from a link
 * @param {string} link - The video link URL
 * @returns {string} - 'youtube', 'vimeo', or 'video'
 */
function getVideoSource(link) {
  if (link.includes('youtube') || link.includes('youtu.be')) return 'youtube';
  if (link.includes('vimeo')) return 'vimeo';
  return 'video';
}

/**
 * Gets a human-readable video type label
 * @param {string} source - The video source type ('youtube', 'vimeo', or 'video')
 * @returns {string} - Human-readable label
 */
function getVideoTypeLabel(source) {
  const labels = {
    youtube: 'YouTube video',
    vimeo: 'Vimeo video',
    video: 'MP4 video',
  };
  return labels[source] || 'video';
}

function embedYoutube(url, options) {
  const usp = new URLSearchParams(url.search);
  let suffix = '';
  const suffixParams = {
    autoplay: options.autoplay ? '1' : '0',
    mute: options.muted ? '1' : '0',
    controls: options.controls ? '1' : '0',
    disablekb: options.controls ? '0' : '1',
    loop: options.loop ? '1' : '0',
    playsinline: options.loop ? '1' : '0',
  };
  suffix = `&${Object.entries(suffixParams).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;

  let vid = usp.get('v') ? encodeURIComponent(usp.get('v')) : '';
  const embed = url.pathname;
  if (url.origin.includes('youtu.be')) {
    [, vid] = url.pathname.split('/');
  }

  const temp = document.createElement('div');
  temp.innerHTML = `<div style="left: 0; width: 100%; height: 0; position: relative; padding-bottom: 56.25%;">
      <iframe src="https://www.youtube.com${vid ? `/embed/${vid}?rel=0&v=${vid}${suffix}` : embed}" style="border: 0; top: 0; left: 0; width: 100%; height: 100%; position: absolute;" 
      allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope; picture-in-picture" allowfullscreen="" scrolling="no" title="Content from Youtube" loading="lazy"></iframe>
    </div>`;
  return temp.children.item(0);
}

function embedVimeo(url, options) {
  const [, video] = url.pathname.split('/');
  const suffixParams = {
    autoplay: options.autoplay ? '1' : '0',
    muted: options.muted ? '1' : '0',
    loop: options.loop ? '1' : '0',
  };
  if (!options.controls) suffixParams.background = '1';
  const suffix = `?${Object.entries(suffixParams).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
  const temp = document.createElement('div');
  temp.innerHTML = `<div style="left: 0; width: 100%; height: 0; position: relative; padding-bottom: 56.25%;">
      <iframe src="https://player.vimeo.com/video/${video}${suffix}" 
      style="border: 0; top: 0; left: 0; width: 100%; height: 100%; position: absolute;" 
      frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen  
      title="Content from Vimeo" loading="lazy"></iframe>
    </div>`;
  return temp.children.item(0);
}

function getVideoElement(source, options) {
  const video = document.createElement('video');
  if (options.controls) video.setAttribute('controls', '');
  if (options.autoplay) video.setAttribute('autoplay', '');
  if (options.muted) video.setAttribute('muted', '');
  if (options.loop) video.setAttribute('loop', '');
  if (options.autoplay || options.loop) video.setAttribute('playsinline', '');

  if (options.muted) {
    video.addEventListener('canplay', () => {
      video.muted = true;
      if (options.autoplay) video.play();
    });
  }

  const sourceEl = document.createElement('source');
  sourceEl.setAttribute('src', source);
  sourceEl.setAttribute('type', `video/${source.split('.').pop()}`);
  video.append(sourceEl);

  return video;
}

function loadVideoEmbed(block, link, options) {
  if (block.dataset.embedLoaded === 'true') return;

  const url = new URL(link);
  const source = getVideoSource(link);

  if (source === 'youtube') {
    const embedWrapper = embedYoutube(url, options);
    block.append(embedWrapper);
    embedWrapper.querySelector('iframe').addEventListener('load', () => {
      block.dataset.embedLoaded = true;
    });
  } else if (source === 'vimeo') {
    const embedWrapper = embedVimeo(url, options);
    block.append(embedWrapper);
    embedWrapper.querySelector('iframe').addEventListener('load', () => {
      block.dataset.embedLoaded = true;
    });
  } else {
    const videoEl = getVideoElement(link, options);
    block.append(videoEl);
    videoEl.addEventListener('canplay', () => {
      block.dataset.embedLoaded = true;
    });
  }
}

export default async function decorate(block) {
  const rows = [...block.children];
  const placeholder = block.querySelector('picture');
  const link = block.querySelector('a').href;

  // Boolean field rows (Row 0: image, Row 1: link, Row 2–5: options)
  const isTrue = (row) => row?.textContent?.trim().toLowerCase() === 'true';
  const options = {
    autoplay: isTrue(rows[2]),
    muted: isTrue(rows[3]),
    loop: isTrue(rows[4]),
    controls: rows[5] ? isTrue(rows[5]) : true,
  };

  block.textContent = '';
  block.dataset.embedLoaded = false;

  if (placeholder) {
    block.classList.add('placeholder');
    const wrapper = document.createElement('div');
    wrapper.className = 'video-placeholder';
    wrapper.append(placeholder);

    if (!options.autoplay) {
      const source = getVideoSource(link);
      const videoType = getVideoTypeLabel(source);
      const ariaLabel = `Play ${videoType}`;

      wrapper.insertAdjacentHTML(
        'beforeend',
        `<div class="video-placeholder-play"><button type="button" title="${ariaLabel}" aria-label="${ariaLabel}"></button></div>`,
      );
      wrapper.addEventListener('click', () => {
        wrapper.remove();
        loadVideoEmbed(block, link, { ...options, autoplay: true });
      });
    }
    block.append(wrapper);
  }

  if (!placeholder || options.autoplay) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer.disconnect();
        const playOnLoad = options.autoplay && !prefersReducedMotion.matches;
        loadVideoEmbed(block, link, { ...options, autoplay: playOnLoad });
      }
    });
    observer.observe(block);
  }
}
