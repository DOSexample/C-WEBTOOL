#include <winsock2.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <direct.h>
#include <signal.h>
#include "server_shm.c"

#define DEFAULT_PORT 80
#define RESPONSE_SIZE   (1024*1024)
const char *DEFAULT_ERROR_404 = "HTTP/1.1 404 Not Found\r\nContent-Type: text/html\r\n\r\n<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>Not Found</h1>The requested URL was not found on this server.</body></html>";
char RESPONSE_BUFFER[RESPONSE_SIZE] = {0};

typedef struct {
    int  type;
    char *value;
    int length;
} REQUEST;

typedef struct {
    char *header;
    char *filename, *filepath;
    int  error;
} RESPONSE;

enum { RQ_UNDEF,GET,POST,PUT } response_types;

void error_live(const char *s)
{
    fprintf(stderr, "Error: %s failed with error %d\n", s, WSAGetLastError());
    WSACleanup();
}

void error_die(const char *s)
{
    error_live(s);
    exit(EXIT_FAILURE);
}

BOOL FileExists(LPCTSTR szPath)
{
  DWORD dwAttrib = GetFileAttributes(szPath);

  return (dwAttrib != INVALID_FILE_ATTRIBUTES && !(dwAttrib & FILE_ATTRIBUTE_DIRECTORY));
}

char *get_content_type(char *name)
{
    char *extension = strchr(name, '.');

    if (!strcmp(extension, ".html"))
        return "text/html";
    else if (!strcmp(extension, ".ico"))
        return "image/webp";
    else if (!strcmp(extension, ".css"))
        return "text/css";
    else if (!strcmp(extension, ".jpg"))
        return "image/jpeg";
    else if (!strcmp(extension, ".js"))
        return "text/javascript";
    else if (!strcmp(extension, ".woff"))
        return "font/woff";
    else if (!strcmp(extension, ".woff2"))
        return "font/woff2";
    else if (!strcmp(extension, ".ttf"))
        return "font/ttf";

    return "*/*";
}

char *get_header(RESPONSE *rs)
{
    if ( !FileExists( rs->filepath ) ) {
        printf("404 Not Found: %s\n", rs->filename);
        rs->error = 404;
        return "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n";
    }

    char header[1024] = {0};
    sprintf(header, "HTTP/1.1 200 OK\r\nContent-Type: %s; charset=UTF-8\r\n\r\n", get_content_type(rs->filename));
    return strdup(header);
}

int get_request_type(char *buf)
{
    char retval[10] = {0};
    sscanf(buf, "%s ", &retval);

    if (!strcmp(retval, "GET"))
        return GET;
    else if (!strcmp(retval, "POST"))
        return POST;
    else if (!strcmp(retval, "PUT"))
        return PUT;
    else
        return RQ_UNDEF;
}

char *get_request_value(char *buf)
{
    char retval[BUFFER_SIZE] = {0};

    sscanf(buf, "%s %s ", &retval, &retval);

    if (retval[strlen(retval)-1] == '/')
        strcat(retval, "index.html");
	
    return strdup(retval);
}

char *get_full_path(char *name)
{
    char filename[1024] = {0};
    getcwd(filename, 1024);
	strcat(filename,"/http");

    int i;
    for (i = 0; i < strlen(filename); i++)
        if (filename[i] == '\\')
            filename[i] = '/';

    strcat(filename, name);
    return strdup(filename);
}

RESPONSE *GetResponse(REQUEST *request)
{
    RESPONSE *response;

    response = malloc(sizeof(RESPONSE));
    response->error    = 0;
    response->filename = request->value;
    response->filepath = get_full_path(request->value);
    response->header   = get_header(response);

    return response;
}

int SendResponse(SOCKET sock, RESPONSE *response)
{
    if (response->error) {
        send(sock, DEFAULT_ERROR_404, strlen(DEFAULT_ERROR_404), 0);
        return 1;
    }
	
    int msg_len;
    FILE *f = fopen( response->filepath, "rb" );
    if ( !f )
    {
        send( sock, "HTTP/1.1 500 Internal Server Error\r\nContent-Length: 0\r\n\r\n", 57, 0 );
        return 1;
    }
    send( sock, response->header, strlen(response->header), 0 );

    int result = 0;
    while ( ( result = fread( RESPONSE_BUFFER, 1, RESPONSE_SIZE, f ) ) > 0 )
    {
        msg_len = send( sock, RESPONSE_BUFFER, result, 0 );
        if  (msg_len == SOCKET_ERROR )
        {
            printf("Error sending data, reconnecting...\n");
            closesocket(sock);
            fclose( f );
            return -1;
        }
        else if ( !msg_len )
        {
            printf("Client closed connection\n");
            closesocket(sock);
            fclose( f );
            return 0;
        }
    }
    //printf("Served file %s\n\n", response->filepath);
    fclose( f );
    return 1;
}

typedef struct {
    char *work_type;
    char *value;
} PARSE;

char* Parse( char* buf, char* txt )
{
	char value[256] = {0};
	char* buf2 = &buf[( (strstr( buf, txt ) - buf ) + strlen(txt) + 2 )];
	int len = 0;
	while( len < strlen(buf2) ){
		if( ( (len + 1) < strlen(buf2) ) && buf2[len] == '\r' && buf2[len+1] == '\n' ){
			break;
		}
		len++;
	}
	memcpy( value, buf2, len );
	return strdup(value);
}

REQUEST *GetRequest(SOCKET sock)
{
    REQUEST *request;
    int msg_len;
    char buf[BUFFER_SIZE];

    msg_len = recv(sock, buf, sizeof(buf), 0);
	
    request         = malloc(sizeof(REQUEST));
    request->type   = get_request_type(buf);
    request->value  = get_request_value(buf);
    request->length = msg_len;

	if( request->type == POST )
	{
        BOOL bWorker = TRUE;
		char resp[BUFFER_SIZE];
		RESPONSE *response = GetResponse(request);
		PARSE			*ps;
		ps				= malloc(sizeof(PARSE));
		ps->work_type	= Parse( buf, "data-work" );
		if( strstr( ps->work_type, "get-client-process" ) != NULL )
		{
			sprintf( resp, "%sresponse-begin:%sresponse-end", response->header, GetProcList() );
		}
		else if( strstr( ps->work_type, "set-execute" ) != NULL ){
			int	processId       = atoi( Parse( buf, "data-pid" ) );
			char* struct_name	= Parse( buf, "data-struct-name" );
			char* struct_size	= Parse( buf, "data-struct-size" );
			char* shm_name	    = Parse( buf, "data-shm-name" );
			char* pattern_key	= Parse( buf, "data-pattern-key" );
			sprintf( resp, "%sresponse-begin:%sresponse-end", response->header, ExecuteAndLoad( processId, struct_name, struct_size, shm_name, pattern_key ) );
		}
		else if( strstr( ps->work_type, "set-runtime-data" ) != NULL ){
			int	  data_position     = atoi( Parse( buf, "data-position" ) );
			char* data_value        = Parse( buf, "data-value" );
			char* data_type         = Parse( buf, "data-type" );
			int   data_size         = atoi( Parse( buf, "data-size" ) );
            sprintf( resp, "%sresponse-begin:%sresponse-end", response->header, SetRuntimeValue( data_position, data_type, data_value, data_size ) );
		}
		else if( strstr( ps->work_type, "save-data" ) != NULL ){
            char* data_filename    = Parse( buf, "data-file-name" );
			char* save_data        = SaveData( data_filename );
            sprintf( resp, "%sresponse-begin:%sresponse-end", response->header, strlen( save_data ) == 0 ? "success|saved" : save_data );
        }
        else{
            bWorker = FALSE;
        }
        if( bWorker )
        {
			response->header = resp;
			SendResponse(sock, response);
        }
		printf( "worker %s\n", ps->work_type );
	}
	
    return request;
}

static void OnSignal(int sig_num )
{
	printf( "signal:%d\n", sig_num );
	exit(sig_num);
}
int main(int argc, char **argv)
{
	signal( SIGINT, OnSignal );
	
    int addr_len;
    struct sockaddr_in local, client_addr;

    SOCKET sock, msg_sock;
    WSADATA wsaData;

    if (WSAStartup(MAKEWORD(2, 2), &wsaData) == SOCKET_ERROR)
        error_die("WSAStartup()");

    // Fill in the address structure
    local.sin_family        = AF_INET;
    local.sin_addr.s_addr   = INADDR_ANY;
    local.sin_port          = htons(DEFAULT_PORT);

    sock = socket(AF_INET, SOCK_STREAM, 0);

    if (sock == INVALID_SOCKET)
        error_die("socket()");

    if (bind(sock, (struct sockaddr *)&local, sizeof(local)) == SOCKET_ERROR)
        error_die("bind()");

listen_goto:

    if (listen(sock, 5) == SOCKET_ERROR)
        error_die("listen()");

    printf("HTTP Server is running on http://localhost:%d\n", DEFAULT_PORT);

    //int count = 0;

    while(1)
    {
        addr_len = sizeof(client_addr);
        msg_sock = accept(sock, (struct sockaddr*)&client_addr, &addr_len);

        if (msg_sock == INVALID_SOCKET || msg_sock == -1)
            error_die("accept()");

        //printf("\n\n#$#$#$#$#$#$#$#$#$#$#$#$#$#$#$#$#$#$#$#$#$#$#$#$#$#$#$#$#$#$#$#$ %d\n\n", ++count);
        //printf("Connected to %s:%d\n", inet_ntoa(client_addr.sin_addr), htons(client_addr.sin_port));

        REQUEST *request = GetRequest(msg_sock);
        if (request->length == 0)
            continue;

        RESPONSE *response = GetResponse(request);
        int sent = SendResponse(msg_sock, response);

        closesocket(msg_sock);

        if (sent == 0)
            break;
        else if (sent == -1)
            goto listen_goto;

    }
    WSACleanup();
}