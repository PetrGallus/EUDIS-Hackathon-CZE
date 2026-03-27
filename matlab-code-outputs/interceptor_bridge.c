#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <arpa/inet.h>
#include <sys/socket.h>
#include <unistd.h>

#define PORT 5005
#define BUF_SIZE 1024

int main() {
    int sockfd;
    char buffer[BUF_SIZE];
    struct sockaddr_in servaddr, cliaddr;
    
    // 1. Vytvoření socketu
    if ((sockfd = socket(AF_INET, SOCK_DGRAM, 0)) < 0) {
        perror("Socket creation failed");
        exit(EXIT_FAILURE);
    }
    
    memset(&servaddr, 0, sizeof(servaddr));
    memset(&cliaddr, 0, sizeof(cliaddr));
    
    servaddr.sin_family = AF_INET;
    servaddr.sin_addr.s_addr = INADDR_ANY; // 0.0.0.0
    servaddr.sin_port = htons(PORT);
    
    // 2. Bind
    if (bind(sockfd, (const struct sockaddr *)&servaddr, sizeof(servaddr)) < 0) {
        perror("Bind failed");
        close(sockfd);
        exit(EXIT_FAILURE);
    }
    
    printf("🚀 C-Receiver naslouchá na portu %d...\n", PORT);
    
    socklen_t len;
    int n;
    
    while(1) {
        len = sizeof(cliaddr);
        n = recvfrom(sockfd, (char *)buffer, BUF_SIZE, MSG_WAITALL, (struct sockaddr *) &cliaddr, &len);
        buffer[n] = '\0';
        
        printf("✅ Paket od %s:%d | Délka: %d | Data: ", 
               inet_ntoa(cliaddr.sin_addr), ntohs(cliaddr.sin_port), n);
        
        // Vypíšeme data (pokud jsou binární, uvidíme aspoň něco)
        for(int i=0; i<n; i++) {
            printf("%02x ", (unsigned char)buffer[i]);
        }
        printf("\n");
    }
    
    return 0;
}