package com.markpro.websocket;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final GradeWebSocketHandler gradeWebSocketHandler;

    public WebSocketConfig(GradeWebSocketHandler gradeWebSocketHandler) {
        this.gradeWebSocketHandler = gradeWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(gradeWebSocketHandler, "/ws/grades")
                .setAllowedOrigins("*");
    }
}
