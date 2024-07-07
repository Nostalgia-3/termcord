export type SupplementalGuild = {
    voice_states: unknown[],
    id: string,
    embedded_activities: unknown[]
};

export type Activity    = unknown;
export type Thread      = unknown;
export type Sticker     = unknown;
export type Emoji       = unknown;

export type Guild = {
    version: number,
    threads: Thread[],
    stickers: Sticker[],
    stage_instances: unknown[],
    roles: GuildRole[],
    properties: {
        home_header: unknown | null,
        afk_channel_id: string | null,
        nsfw: boolean,
        splash: unknown | null,
        incidents_data: unknown | null,
        vanity_url_code: unknown | null,
        icon: unknown | null,
        id: string,
        default_message_notifications: number,
        name: string,
        rules_channel_id: string | null,
        latest_onboarding_question_id: string | null,
        afk_timeout: number,
        features: unknown[],
        discovery_splash: unknown | null,
        verification_level: number,
        premium_progress_bar_enabled: boolean,
        description: string | null,
        application_id: string | null,
        safety_alerts_channel_id: string | null,
        preferred_locale: string,
        banner: unknown | null,
        system_channel_id: string,
        system_channel_flags: number,
        mfa_level: number,
        owner_id: string,
        premium_tier: number,
        max_members: number,
        public_updates_channel_id: unknown | null,
        nsfw_level: number,
        clan: unknown | null,
        max_video_channel_users: number,
        hub_type: unknown | null,
        max_stage_video_channel_users: number,
        explicit_content_filter: number
    },
    premium_subscription_count: number,
    member_count: number,
    lazy: boolean,
    large: boolean,
    joined_at: string,
    id: string,
    guild_scheduled_events: unknown[],
    emojis: Emoji[],
    data_mode: string,
    channels: GuildChannel[],
    application_command_counts: Record<string, unknown>,
    activity_instances: Record<string, unknown>
};

export type GuildRole = {
    unicode_emoji: unknown | null,
    tags: Record<string, unknown>,
    position: number,
    permissions: string,
    name: string,
    mentionable: boolean,
    managed: boolean,
    id: string,
    icon: unknown | null,
    hoist: boolean,
    flags: number,
    color: number
};

export type GuildChannel = {
    type: number,
    position: number,
    flags: boolean
}

export type User = {
    username: string,
    public_flags: number,
    id: string,
    global_name: unknown | null,
    discriminator: string,
    clan: unknown | null,
    avatar_decoration_data: unknown | null,
    avatar: string | null
};

export type SelfUser = {
    verified: boolean,
    username: string,
    purchased_flags: boolean,
    public_flags: boolean,
    pronouns: string,
    premium_type: number,
    premium: boolean,
    phone: unknown,
    nsfw_allowed: boolean,
    mobile: boolean,
    mfa_enabled: boolean,
    id: string,
    global_name: string,
    flags: number,
    email:  string,
    discriminator: string,
    desktop: boolean,
    clan: unknown | null,
    bio: string,
    banner_color: string | null,
    banner: string | null,
    avatar_decoration_data: string | null,
    avatar: string | null,
    accent_color: string | null
};

export type UserGuildSettings = {
    version: number,
    partial: boolean,
    entries: Record<string, unknown>[]
};

export type Session = {
    status: 'dnd' | 'online' | 'away', // assuming 'away' exists
    session_id: string,
    client_info: {
        version: number,
        os: string,
        client: string
    },
    activities: Activity[]
};

export type Relationship = {
    user_id: string,
    type: number,
    nickname: string | null,
    id: string
};

export type ReadState = {
    mention_count: number,
    last_viewed: number,
    last_pin_timestamp: string,
    last_message_id: string,
    id: string,
    flags: number
};

export type PrivateChannel = {
    type: number,
    safety_warnings: unknown[],
    recipient_ids: string[],
    last_message_id: string,
    is_spam: boolean,
    id: string,
    flags: number
};

export type ReadySupplementalPacket = {
    merged_presences: {
        guilds: unknown[],
        friends: {
            user_id: string,
            status: string,
            client_status: Record<string, unknown>,
            activites: Record<string, unknown>[]
        }[]
    },
    merged_members: unknown[],
    lazy_private_channels: unknown,
    guilds: SupplementalGuild[],
    game_invites: unknown[],
    disclose: string[]
}

export type ReadyPacket = {
    v: number,
    users: User[],
    user_settings_proto: string,
    user_guild_settings: UserGuildSettings,
    user: SelfUser,
    tutorial: unknown | null,
    static_client_session_id: string,
    sessions: Session[],
    session_type: string,
    session_id: string,
    resume_gateway_url: string,
    relationships: Relationship[],
    read_state: {
        version: number,
        partial: boolean,
        entries: ReadState[]
    },
    private_channels: PrivateChannel[],
    notification_settings: { flags: number },
    merged_members: unknown[],
    guilds: Guild[],
    guild_join_requests: unknown[],
    geo_ordered_rtc_regions: string[],
    friend_suggestion_count: number,
    explicit_content_scan_version: number,
    country_code: string,
    consents: { personalization: { consented: boolean } },
    connected_accounts: unknown[],
    auth_session_id_hash: string,
    auth: { authenticator_types: unknown[] },
    api_code_version: number,
    analytics_token: string,
    _trace: string[]
};