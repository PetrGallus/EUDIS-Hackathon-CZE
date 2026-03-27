

function JSON_Send = JSON_Send(data)
    
    u = udpport();
    data = struct('data', data); % Přidejte víc polí
    msg = jsonencode(data);
    
    % POSLAT JAKO STRING (tohle je klíčové, vytvoří to delší paket)
    write(u, msg, "string", "172.31.190.24", 5005);

end
  